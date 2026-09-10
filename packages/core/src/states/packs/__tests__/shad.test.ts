import type { BaseShadConfig, BaseSmoothConfig } from '@flowdown/core-presets/mapper';
import type { IBlockState, PluginSet } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { Shad } from '@flowdown/core-presets/mapper';
import { assert } from '@flowdown/utils';
import { last } from 'lodash-es';
import {
  D,
  type IReadableClosure,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  useFlatten,
  useMap,
} from 'reactive';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../../typings';
import type { MapperPluggable } from '../../base';
import type { CoreInputs } from '../type';

import { readParts } from '../../../__tests__/shad/utils';
import { collectText, firstBlock } from '../../../__tests__/smooth/utils';
import { FakeSmoothTicker, StepSmoothScheduler } from '../../../__tests__/utils/smooth';
import { BaseRenderer } from '../../../externals';
import { Core } from '../index';

type Block = IBlockState<HastRoot>;

class BlockRenderer extends BaseRenderer<HastRoot, ElementContent, Parent, Block> {
  protected renderItem(block: Block) {
    return block;
  }
}

class ManualTicker extends FakeSmoothTicker {
  static instances: ManualTicker[] = [];

  constructor() {
    super();

    ManualTicker.instances.push(this);
  }
}

const build = { repair: false, repairEnding: false, footnote: false, tex: false };

const smooth: BaseSmoothConfig = {
  enabled: true,
  ticker: ManualTicker,
  scheduler: StepSmoothScheduler,
};

const enabled: BaseShadConfig = { enabled: true, length: 2 };

const disabled: BaseShadConfig = { ...enabled, enabled: false };

type ConfiguredCoreInputs = Omit<CoreInputs<Block>, 'mappers'> & {
  shad?: IReadableClosure<BaseShadConfig>;

  smooth?: IReadableClosure<BaseSmoothConfig>;

  mappers?: IReadableClosure<MapperPluggable[] | undefined>;
};

const ConfiguredCore = once(
  ({ shad, smooth: smoothSource, mappers, ...inputs }: ConfiguredCoreInputs) => {
    const configs: MapperConfigs = {
      shad: shad ? useFlatten(shad) : undefined,
      smooth: smoothSource ? useFlatten(smoothSource) : undefined,
    };

    return S([
      Core<Block>,
      {
        ...inputs,
        Renderer: D(inputs.Renderer),
        mappers: mappers
          ? useMap(mappers, (items): PluginSet<MapperPluggable, MapperConfigs> => items ?? configs)
          : ReactiveState.of<PluginSet<MapperPluggable, MapperConfigs>>(configs),
      },
    ]);
  },
);

const closures = new Set<IReadableClosure<Block[]>>();

const setup = (
  initialText: string,
  initialShad?: BaseShadConfig,
  initialSmooth?: BaseSmoothConfig,
) => {
  const text = MutableState.of(initialText);

  const shad = MutableState.of(initialShad ?? disabled);

  const mappers = MutableState.of<MapperPluggable[] | undefined>(undefined);

  const core = render(
    S([
      ConfiguredCore,
      {
        Renderer: D(BlockRenderer),
        text,
        build,
        shad: initialShad === undefined ? undefined : shad,
        mappers,
        smooth: initialSmooth === undefined ? undefined : ReactiveState.of(initialSmooth),
        patches: [],
        renders: [],
      },
    ]),
  );

  closures.add(core);

  const read = () => core.value.value.map((block) => collectText(block.value.value));

  const tick = (timestamp: number) => {
    const ticker = last(ManualTicker.instances);

    assert(ticker);

    ticker.tick(timestamp);
  };

  return { core, read, mappers, shad, text, tick };
};

beforeEach(() => {
  vi.useFakeTimers();

  ManualTicker.instances = [];

  StepSmoothScheduler.instances = [];
});

afterEach(() => {
  closures.forEach((closure) => closure.destroy());

  closures.clear();

  vi.useRealTimers();
});

describe('Core shad pipeline', () => {
  test('keeps a bare Shad disabled and defaults its configured tail length to two', () => {
    const view = setup('abcd');

    view.mappers.next([Shad]);

    expect(readParts(firstBlock(view.core.value.value).value.value)).toBeUndefined();

    view.mappers.next([[Shad, { enabled: ReactiveState.of(true) }]]);

    expect(readParts(firstBlock(view.core.value.value).value.value)).toEqual({
      leading: 'cd',
      active: '',
    });

    view.text.next('abcde');

    expect(readParts(firstBlock(view.core.value.value).value.value)).toEqual({
      leading: 'd',
      active: 'e',
    });
  });

  test('overrides the Shad preset through a public mapper tuple and restores its configuration', () => {
    const view = setup('abcd', enabled);

    view.mappers.next([[Shad, { enabled: ReactiveState.of(false), length: ReactiveState.of(4) }]]);

    view.text.next('abcde');

    expect(view.read()).toEqual(['abcde']);

    expect(readParts(firstBlock(view.core.value.value).value.value)).toBeUndefined();

    view.mappers.next(undefined);

    expect(readParts(firstBlock(view.core.value.value).value.value)).toEqual({
      leading: 'de',
      active: '',
    });

    view.text.next('abcdef');

    expect(readParts(firstBlock(view.core.value.value).value.value)?.active).toBe('f');
  });

  test.each([undefined, disabled, { enabled: false, length: 4 }])(
    'keeps shading disabled for %j',
    (config) => {
      const view = setup('abcd', config);

      expect(view.read()).toEqual(['abcd']);

      expect(readParts(firstBlock(view.core.value.value).value.value)).toBeUndefined();

      view.text.next('abcde');

      expect(view.read()).toEqual(['abcde']);

      expect(readParts(firstBlock(view.core.value.value).value.value)).toBeUndefined();

      expect(vi.getTimerCount()).toBe(1);
    },
  );

  test('uses the default tail length and applies live configuration', () => {
    const view = setup('abcd', enabled);

    const fork = firstBlock(view.core.value.value);

    expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

    view.text.next('abcde');

    expect(readParts(fork.value.value)).toEqual({ leading: 'd', active: 'e' });

    view.shad.next({ ...enabled, length: 4 });

    expect(readParts(fork.value.value)).toEqual({ leading: 'bcd', active: 'e' });

    view.shad.next(disabled);

    expect(view.read()).toEqual(['abcde']);

    expect(readParts(fork.value.value)).toBeUndefined();

    view.shad.next(enabled);

    expect(firstBlock(view.core.value.value)).toBe(fork);

    expect(readParts(fork.value.value)).toEqual({ leading: 'de', active: '' });
  });

  test('shades newly visible Smooth output only after its ticks and keeps lengths consistent', () => {
    const view = setup('', enabled, smooth);

    expect(view.read()).toEqual([]);

    view.text.next('abcd');

    expect(view.read()).toEqual(['']);

    const fork = firstBlock(view.core.value.value);

    expect(readParts(fork.value.value)).toBeUndefined();

    expect(vi.getTimerCount()).toBe(0);

    view.tick(16);

    expect(view.read()).toEqual(['a']);

    expect(readParts(fork.value.value)).toEqual({ leading: '', active: 'a' });

    expect(fork.length.value).toBe(1);

    view.tick(32);

    expect(view.read()).toEqual(['ab']);

    expect(readParts(fork.value.value)).toEqual({ leading: '', active: 'ab' });

    vi.advanceTimersByTime(200);

    expect(readParts(fork.value.value)).toEqual({ leading: 'ab', active: '' });

    view.tick(48);

    expect(readParts(fork.value.value)).toEqual({ leading: 'b', active: 'c' });

    expect(fork.length.value).toBe(3);

    view.tick(64);

    expect(view.read()).toEqual(['abcd']);

    expect(readParts(fork.value.value)).toEqual({ leading: '', active: 'cd' });
  });

  test.each([disabled, enabled, { ...enabled, length: 3 }])(
    'completes a static document for shad %j without a timer',
    (shad) => {
      const core = render(
        S([
          ConfiguredCore,
          {
            Renderer: D(BlockRenderer),
            text: ReactiveState.of('ready'),
            build,
            shad: ReactiveState.of(shad),
            smooth: ReactiveState.of(smooth),
            patches: [],
            renders: [],
          },
        ]),
      );

      closures.add(core);

      const block = firstBlock(core.value.value);

      expect(collectText(block.value.value)).toBe('ready');

      expect(readParts(block.value.value)).toEqual(
        shad.enabled ? { leading: shad.length === 2 ? 'dy' : 'ady', active: '' } : undefined,
      );

      expect(core.value.closed).toBe(true);

      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test('finishes the final tail after the stream completes and clears resources on destroy', () => {
    const view = setup('abc', enabled);

    const fork = firstBlock(view.core.value.value);

    expect(readParts(fork.value.value)).toEqual({ leading: 'bc', active: '' });

    view.text.next('abcd');

    view.text.complete();

    view.shad.complete();

    view.mappers.complete();

    expect(readParts(fork.value.value)).toEqual({ leading: 'c', active: 'd' });

    expect(fork.value.closed).toBe(false);

    vi.advanceTimersByTime(200);

    expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

    expect(view.core.value.closed).toBe(true);

    const value = fork.value;

    view.core.destroy();

    expect(value.closed).toBe(true);

    expect(vi.getTimerCount()).toBe(0);
  });
});
