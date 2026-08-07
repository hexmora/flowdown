import type { IBasePluginConfig, IPluginWithConfig, PluginClass } from '@flowdown/types';

import { type IReactiveState, toReactiveState } from '@flowdown/reactive';
import { isArray } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { PluginBuilderStateClosure } from '..';
import { buildPluggables, isPluggableEqual } from '../utils';

interface TestPluginConfig extends IBasePluginConfig {
  label?: string;
  nested?: {
    enabled: boolean;
  };
}

interface TestPlugin extends IPluginWithConfig {
  readonly key: string;
  config: TestPluginConfig;
  destroy: () => void;
}

class TestPluginBuilderStateClosure extends PluginBuilderStateClosure<TestPlugin> {}

const assertType = <T>(_value: T) => undefined;

const createPluginClass = (
  key: string,
  onConstruct: (config: unknown) => void,
  onDestroy: () => void = () => undefined,
): PluginClass<TestPlugin> => {
  const pluginKey = key;

  return class implements TestPlugin {
    static readonly key = pluginKey;

    readonly key = pluginKey;

    config: TestPluginConfig;

    destroy = vi.fn(onDestroy);

    constructor(config: unknown = {}) {
      onConstruct(config);
      this.config = config as TestPluginConfig;
    }
  };
};

const setupBuilder = (
  initialPlugins: PluginClass<TestPlugin>[],
  initialConfigs: Record<string, unknown>,
) => {
  const plugins = new BehaviorSubject(initialPlugins);
  const configs = new BehaviorSubject(initialConfigs);
  const closure = new TestPluginBuilderStateClosure({
    plugins: toReactiveState(plugins),
    configs: toReactiveState(configs),
  });

  return { closure, configs, plugins };
};

const findPlugin = (plugins: TestPlugin[], key: string) => {
  return plugins.find((plugin) => plugin.key === key);
};

const getObserverCount = (state: IReactiveState<unknown>) => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

describe('PluginBuilderStateClosure', () => {
  test('compares plugin classes by reference and configs deeply', () => {
    const PluginA = createPluginClass('same-key', vi.fn());
    const ReplacementPluginA = createPluginClass('same-key', vi.fn());

    expect(isPluggableEqual(PluginA, PluginA)).toBe(true);
    expect(isPluggableEqual(PluginA, ReplacementPluginA)).toBe(false);
    expect(
      isPluggableEqual(
        [PluginA, { nested: { enabled: true } }],
        [PluginA, { nested: { enabled: true } }],
      ),
    ).toBe(true);
    expect(
      isPluggableEqual(
        [PluginA, { nested: { enabled: true } }],
        [PluginA, { nested: { enabled: false } }],
      ),
    ).toBe(false);
    expect(
      isPluggableEqual(
        [PluginA, { nested: { enabled: true } }],
        [ReplacementPluginA, { nested: { enabled: true } }],
      ),
    ).toBe(false);
  });

  test('buildPluggables returns one instance or an array based on argument count', () => {
    const constructA = vi.fn();
    const constructB = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const PluginB = createPluginClass('b', constructB);

    const empty = buildPluggables<TestPlugin>();
    const single = buildPluggables(PluginA);
    const multiple = buildPluggables(PluginA, PluginB);

    assertType<TestPlugin[]>(empty);
    assertType<TestPlugin>(single);
    assertType<TestPlugin[]>(multiple);
    expect(empty).toEqual([]);
    expect(isArray(single)).toBe(false);
    expect(single.key).toBe('a');
    expect(multiple.map((plugin) => plugin.key)).toEqual(['a', 'b']);
  });

  test('lazily builds the initial plugin instances with their configs', () => {
    const constructA = vi.fn();
    const constructB = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const PluginB = createPluginClass('b', constructB);
    const configA = { label: 'configured' };
    const { closure } = setupBuilder([PluginA, PluginB], { a: configA });

    expect(constructA).not.toHaveBeenCalled();
    expect(constructB).not.toHaveBeenCalled();

    const [pluginA, pluginB] = closure.value.value;

    expect(constructA).toHaveBeenCalledOnce();
    expect(constructA).toHaveBeenCalledWith(configA);
    expect(constructB).toHaveBeenCalledOnce();
    expect(pluginA?.config).toBe(configA);
    expect(pluginB?.config).toEqual({});
  });

  test('reuses instances when plugins are reordered or configs are deeply equal', () => {
    const constructA = vi.fn();
    const constructB = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const PluginB = createPluginClass('b', constructB);
    const { closure, configs, plugins } = setupBuilder([PluginA, PluginB], {
      a: { nested: { enabled: true } },
      b: { label: 'b' },
    });
    const [initialA, initialB] = closure.value.value;

    plugins.next([PluginB, PluginA]);

    expect(closure.value.value).toEqual([initialB, initialA]);
    expect(constructA).toHaveBeenCalledOnce();
    expect(constructB).toHaveBeenCalledOnce();

    configs.next({
      a: { nested: { enabled: true } },
      b: { label: 'b' },
    });

    expect(closure.value.value).toEqual([initialB, initialA]);
    expect(constructA).toHaveBeenCalledOnce();
    expect(constructB).toHaveBeenCalledOnce();
  });

  test('keeps source pluggables paired with their instances across priority sorting', () => {
    const constructLow = vi.fn();
    const constructHigh = vi.fn();
    const PluginLow = createPluginClass('low', constructLow);
    const PluginHigh = createPluginClass('high', constructHigh);
    const { closure, configs } = setupBuilder([PluginLow, PluginHigh], {
      low: { label: 'low:1', priority: 1 },
      high: { label: 'high', priority: -1 },
    });
    const initial = closure.value.value;
    const initialLow = findPlugin(initial, 'low');
    const initialHigh = findPlugin(initial, 'high');

    expect(initial.map((plugin) => plugin.key)).toEqual(['high', 'low']);

    configs.next({
      low: { label: 'low:2', priority: 1 },
      high: { label: 'high', priority: -1 },
    });

    const current = closure.value.value;
    const currentLow = findPlugin(current, 'low');
    const currentHigh = findPlugin(current, 'high');

    expect(current.map((plugin) => plugin.key)).toEqual(['high', 'low']);
    expect(currentLow).not.toBe(initialLow);
    expect(currentLow?.config.label).toBe('low:2');
    expect(currentHigh).toBe(initialHigh);
    expect(initialLow?.destroy).toHaveBeenCalledOnce();
    expect(initialHigh?.destroy).not.toHaveBeenCalled();
    expect(constructLow).toHaveBeenCalledTimes(2);
    expect(constructHigh).toHaveBeenCalledOnce();
  });

  test('rebuilds only plugins whose class or config changed', () => {
    const constructA = vi.fn();
    const constructReplacementA = vi.fn();
    const constructB = vi.fn();
    const constructC = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const ReplacementPluginA = createPluginClass('a', constructReplacementA);
    const PluginB = createPluginClass('b', constructB);
    const PluginC = createPluginClass('c', constructC);
    const { closure, configs, plugins } = setupBuilder([PluginA, PluginB], {
      a: { label: 'a:1' },
      b: { label: 'b:1' },
    });
    const [initialA, initialB] = closure.value.value;

    configs.next({
      a: { label: 'a:2' },
      b: { label: 'b:1' },
    });

    const [configuredA, unchangedB] = closure.value.value;
    expect(configuredA).not.toBe(initialA);
    expect(configuredA?.config).toEqual({ label: 'a:2' });
    expect(unchangedB).toBe(initialB);
    expect(constructA).toHaveBeenCalledTimes(2);
    expect(constructB).toHaveBeenCalledOnce();
    expect(initialA?.destroy).toHaveBeenCalledOnce();
    expect(initialB?.destroy).not.toHaveBeenCalled();

    plugins.next([ReplacementPluginA, PluginB, PluginC]);

    const [replacementA, reusedB, addedC] = closure.value.value;
    expect(replacementA).not.toBe(configuredA);
    expect(replacementA?.config).toEqual({ label: 'a:2' });
    expect(reusedB).toBe(initialB);
    expect(addedC?.key).toBe('c');
    expect(constructReplacementA).toHaveBeenCalledOnce();
    expect(constructB).toHaveBeenCalledOnce();
    expect(constructC).toHaveBeenCalledOnce();
    expect(configuredA?.destroy).toHaveBeenCalledOnce();
    expect(initialB?.destroy).not.toHaveBeenCalled();

    plugins.next([PluginC]);

    expect(closure.value.value).toEqual([addedC]);
    expect(constructC).toHaveBeenCalledOnce();
    expect(replacementA?.destroy).toHaveBeenCalledOnce();
    expect(initialB?.destroy).toHaveBeenCalledOnce();

    closure.destroy();
    closure.destroy();

    expect(addedC?.destroy).toHaveBeenCalledOnce();
    expect(replacementA?.destroy).toHaveBeenCalledOnce();
    expect(initialB?.destroy).toHaveBeenCalledOnce();
  });

  test('destroys instances and subscriptions without destroying caller inputs', () => {
    const Plugin = createPluginClass('plugin', vi.fn());
    const pluginsSubject = new BehaviorSubject([Plugin]);
    const configsSubject = new BehaviorSubject<Record<string, unknown>>({});
    const plugins = toReactiveState(pluginsSubject);
    const configs = toReactiveState(configsSubject);
    const closure = new TestPluginBuilderStateClosure({
      plugins,
      configs,
    });
    const [instance] = closure.value.value;

    expect(getObserverCount(plugins)).toBeGreaterThan(0);
    expect(getObserverCount(configs)).toBeGreaterThan(0);

    closure.destroy();

    expect(instance?.destroy).toHaveBeenCalledOnce();
    expect(plugins.closed).toBe(false);
    expect(configs.closed).toBe(false);
    expect(getObserverCount(plugins)).toBe(0);
    expect(getObserverCount(configs)).toBe(0);

    plugins.destroy();
    configs.destroy();
  });

  test('destroys current instances after a plugin source error', () => {
    const Plugin = createPluginClass('plugin', vi.fn());
    const pluginsSubject = new BehaviorSubject([Plugin]);
    const configsSubject = new BehaviorSubject<Record<string, unknown>>({});
    const plugins = toReactiveState(pluginsSubject);
    const configs = toReactiveState(configsSubject);
    const closure = new TestPluginBuilderStateClosure({ plugins, configs });
    const error = vi.fn();
    const reason = new Error('failed');

    closure.value.subscribe({ error });

    const [instance] = closure.value.value;

    pluginsSubject.error(reason);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(reason);
    expect(configs.closed).toBe(false);
    expect(getObserverCount(configs)).toBe(0);
    expect(() => closure.destroy()).not.toThrow();
    expect(instance?.destroy).toHaveBeenCalledOnce();

    plugins.destroy();
    configs.destroy();
  });

  test('destroying before initialization constructs no plugins', () => {
    const construct = vi.fn();
    const Plugin = createPluginClass('plugin', construct);
    const { closure } = setupBuilder([Plugin], {});

    closure.destroy();
    closure.destroy();

    expect(construct).not.toHaveBeenCalled();
    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');
  });
});
