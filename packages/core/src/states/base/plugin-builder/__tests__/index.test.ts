import type {
  IBasePluginConfig,
  IPluggable,
  IPluginWithConfig,
  PluginClass,
} from '@flowdown/types';

import { isArray } from 'lodash-es';
import { type IReactiveState, render, S, toReactiveState } from 'reactive';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { isPluggableEqual, PluginBuilderStateClosure } from '..';
import { buildPluggables } from '../utils';

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

const assertType = <T>(_value: T) => undefined;

const createPluginClass = (
  key: string,
  onConstruct: (config: unknown) => void,
  onDestroy: () => void = () => undefined,
): PluginClass<TestPlugin, unknown> => {
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

const setupBuilder = (initialPlugins: IPluggable<TestPlugin, unknown>[], sort = true) => {
  const pluginsSubject = new BehaviorSubject(initialPlugins);
  const plugins = toReactiveState(pluginsSubject);
  const closure = render(S([PluginBuilderStateClosure<TestPlugin>, { plugins, sort }]));

  return { closure, plugins, pluginsSubject };
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
  test('compares plugin classes by reference and tuple options deeply', () => {
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
    const PluginA = createPluginClass('a', vi.fn());
    const PluginB = createPluginClass('b', vi.fn());

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

  test('lazily builds bare and tuple plugins with embedded options', () => {
    const constructA = vi.fn();
    const constructB = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const PluginB = createPluginClass('b', constructB);
    const optionsA = { label: 'configured' };
    const { closure } = setupBuilder([[PluginA, optionsA], PluginB]);

    expect(constructA).not.toHaveBeenCalled();
    expect(constructB).not.toHaveBeenCalled();

    const [pluginA, pluginB] = closure.value.value;

    expect(constructA).toHaveBeenCalledOnce();
    expect(constructA).toHaveBeenCalledWith(optionsA);
    expect(constructB).toHaveBeenCalledOnce();
    expect(pluginA?.config).toBe(optionsA);
    expect(pluginB?.config).toEqual({});
  });

  test('reuses instances when reordered tuples have deeply equal options', () => {
    const constructA = vi.fn();
    const constructB = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const PluginB = createPluginClass('b', constructB);
    const { closure, pluginsSubject } = setupBuilder([
      [PluginA, { nested: { enabled: true } }],
      [PluginB, { label: 'b' }],
    ]);
    const [initialA, initialB] = closure.value.value;

    pluginsSubject.next([
      [PluginB, { label: 'b' }],
      [PluginA, { nested: { enabled: true } }],
    ]);

    expect(closure.value.value).toEqual([initialB, initialA]);
    expect(constructA).toHaveBeenCalledOnce();
    expect(constructB).toHaveBeenCalledOnce();
  });

  test('publishes reused instances for equivalent source emissions', () => {
    const Plugin = createPluginClass('plugin', vi.fn());
    const { closure, pluginsSubject } = setupBuilder([[Plugin, { nested: { enabled: true } }]]);
    const [instance] = closure.value.value;
    const next = vi.fn();

    closure.value.subscribe(next);

    next.mockClear();

    pluginsSubject.next([[Plugin, { nested: { enabled: true } }]]);

    expect(closure.value.value).toEqual([instance]);
    expect(next).toHaveBeenCalledOnce();
  });

  test('keeps source pluggables paired across sorting and replaces only changed options', () => {
    const constructLow = vi.fn();
    const constructHigh = vi.fn();
    const PluginLow = createPluginClass('low', constructLow);
    const PluginHigh = createPluginClass('high', constructHigh);
    const { closure, pluginsSubject } = setupBuilder([
      [PluginLow, { label: 'low:1', priority: 1 }],
      [PluginHigh, { label: 'high', priority: -1 }],
    ]);
    const initial = closure.value.value;
    const initialLow = findPlugin(initial, 'low');
    const initialHigh = findPlugin(initial, 'high');

    expect(initial.map((plugin) => plugin.key)).toEqual(['high', 'low']);

    pluginsSubject.next([
      [PluginLow, { label: 'low:2', priority: 1 }],
      [PluginHigh, { label: 'high', priority: -1 }],
    ]);

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

  test('can preserve declaration order when sorting is disabled', () => {
    const PluginLow = createPluginClass('low', vi.fn());
    const PluginHigh = createPluginClass('high', vi.fn());
    const { closure } = setupBuilder(
      [
        [PluginLow, { priority: 1 }],
        [PluginHigh, { priority: -1 }],
      ],
      false,
    );

    expect(closure.value.value.map((plugin) => plugin.key)).toEqual(['low', 'high']);
  });

  test('replaces changed classes and retires removed/current instances once', () => {
    const constructA = vi.fn();
    const constructReplacementA = vi.fn();
    const constructB = vi.fn();
    const PluginA = createPluginClass('a', constructA);
    const ReplacementPluginA = createPluginClass('a', constructReplacementA);
    const PluginB = createPluginClass('b', constructB);
    const { closure, pluginsSubject } = setupBuilder([
      [PluginA, { label: 'a' }],
      [PluginB, { label: 'b' }],
    ]);
    const [initialA, initialB] = closure.value.value;

    pluginsSubject.next([
      [ReplacementPluginA, { label: 'a' }],
      [PluginB, { label: 'b' }],
    ]);

    const [replacementA, reusedB] = closure.value.value;

    expect(replacementA).not.toBe(initialA);
    expect(reusedB).toBe(initialB);
    expect(initialA?.destroy).toHaveBeenCalledOnce();
    expect(initialB?.destroy).not.toHaveBeenCalled();

    pluginsSubject.next([[ReplacementPluginA, { label: 'a' }]]);

    expect(initialB?.destroy).toHaveBeenCalledOnce();

    closure.destroy();
    closure.destroy();

    expect(replacementA?.destroy).toHaveBeenCalledOnce();
    expect(initialA?.destroy).toHaveBeenCalledOnce();
    expect(initialB?.destroy).toHaveBeenCalledOnce();
    expect(constructA).toHaveBeenCalledOnce();
    expect(constructReplacementA).toHaveBeenCalledOnce();
    expect(constructB).toHaveBeenCalledOnce();
  });

  test('destroys instances and subscriptions without destroying caller input', () => {
    const Plugin = createPluginClass('plugin', vi.fn());
    const { closure, plugins } = setupBuilder([Plugin]);
    const [instance] = closure.value.value;

    expect(getObserverCount(plugins)).toBeGreaterThan(0);

    closure.destroy();

    expect(instance?.destroy).toHaveBeenCalledOnce();
    expect(plugins.closed).toBe(false);
    expect(getObserverCount(plugins)).toBe(0);

    plugins.destroy();
  });

  test('destroys current instances after a plugin source error', () => {
    const Plugin = createPluginClass('plugin', vi.fn());
    const { closure, plugins, pluginsSubject } = setupBuilder([Plugin]);
    const error = vi.fn();
    const reason = new Error('failed');

    closure.value.subscribe({ error });

    const [instance] = closure.value.value;

    pluginsSubject.error(reason);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(reason);
    expect(() => closure.destroy()).not.toThrow();
    expect(instance?.destroy).toHaveBeenCalledOnce();

    plugins.destroy();
  });

  test('destroying before initialization constructs no plugins', () => {
    const construct = vi.fn();
    const Plugin = createPluginClass('plugin', construct);
    const { closure } = setupBuilder([Plugin]);

    closure.destroy();
    closure.destroy();

    expect(construct).not.toHaveBeenCalled();
    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');
  });
});
