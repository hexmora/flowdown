import type { ShadConfig, SmoothConfig } from '@flowdown/core-presets/mapper';
import type { IBlockState } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { Shad } from '@flowdown/core-presets/mapper';
import { assert } from '@flowdown/utils';
import { last } from 'lodash-es';
import { D, type IReadableClosure, MutableState, ReactiveState, render, S } from 'reactive';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../../typings';
import type { MapperPluggable } from '../../base';

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

const smooth: SmoothConfig = {
  enabled: true,
  ticker: ManualTicker,
  scheduler: StepSmoothScheduler,
};

const closures = new Set<IReadableClosure<Block[]>>();

const setup = (
  initialText: string,
  initialShad?: boolean | ShadConfig,
  initialSmooth: boolean | SmoothConfig = false,
) => {
  const text = MutableState.of(initialText);

  const shad = MutableState.of(initialShad ?? false);

  const mappers = MutableState.of<MapperPluggable[]>([]);

  const core = render(
    S([
      Core<Block>,
      {
        Renderer: D(BlockRenderer),
        text,
        build,
        shad: initialShad === undefined ? undefined : shad,
        mappers,
        smooth: ReactiveState.of(initialSmooth),
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
  test('overrides the Shad preset through a public mapper tuple and restores its configuration', () => {
    const view = setup('abcd', true);

    view.mappers.next([[Shad, { enabled: ReactiveState.of(false), length: ReactiveState.of(4) }]]);

    view.text.next('abcde');

    expect(view.read()).toEqual(['abcde']);

    expect(readParts(firstBlock(view.core.value.value).value.value)).toBeUndefined();

    view.mappers.next([]);

    expect(readParts(firstBlock(view.core.value.value).value.value)).toEqual({
      leading: 'de',
      active: '',
    });

    view.text.next('abcdef');

    expect(readParts(firstBlock(view.core.value.value).value.value)?.active).toBe('f');
  });

  test.each([undefined, false, { enabled: false, length: 4 }])(
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

  test.each([true, {}])(
    'uses the default tail length for %j and applies live configuration',
    (config) => {
      const view = setup('abcd', config);

      const fork = firstBlock(view.core.value.value);

      expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

      view.text.next('abcde');

      expect(readParts(fork.value.value)).toEqual({ leading: 'd', active: 'e' });

      view.shad.next({ length: 4 });

      expect(readParts(fork.value.value)).toEqual({ leading: 'bcd', active: 'e' });

      view.shad.next(false);

      expect(view.read()).toEqual(['abcde']);

      expect(readParts(fork.value.value)).toBeUndefined();

      view.shad.next(true);

      expect(firstBlock(view.core.value.value)).toBe(fork);

      expect(readParts(fork.value.value)).toEqual({ leading: 'de', active: '' });
    },
  );

  test('shades newly visible Smooth output only after its ticks and keeps lengths consistent', () => {
    const view = setup('', true, smooth);

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

  test.each([false, true, { length: 3 }])(
    'completes a static document for shad %j without a timer',
    (shad) => {
      const core = render(
        S([
          Core<Block>,
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
        shad === false ? undefined : { leading: shad === true ? 'dy' : 'ady', active: '' },
      );

      expect(core.value.closed).toBe(true);

      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test('finishes the final tail after the stream completes and clears resources on destroy', () => {
    const view = setup('abc', true);

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
