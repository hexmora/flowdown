import type { SmoothConfig } from '@flowdown/core-presets/mapper';
import type { IBlockState } from '@flowdown/types';
import type { ElementContent, Parent, RootContent } from 'hast';
import type { Plugin } from 'unified';

import { BaseRehypePlugin } from '@flowdown/core-presets/rehype';
import { assert } from '@flowdown/utils';
import { first, last } from 'lodash-es';
import { D, type IReadableClosure, MutableState, ReactiveState, render, S } from 'reactive';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../../typings';

import { Core } from '..';
import {
  DoubleStepSmoothScheduler,
  FakeSmoothTicker,
  StepSmoothScheduler,
} from '../../../__tests__/utils/smooth';
import { BaseRenderer } from '../../../externals';

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

class ReplacementTicker extends ManualTicker {}

const compiled = vi.fn();

class ObserveCompilation extends BaseRehypePlugin {
  static readonly key = 'observe-smooth-compilation';

  readonly config = {};

  plugin: Plugin<[], HastRoot, HastRoot> = () => (tree) => {
    compiled(tree);
  };
}

const build = { repair: false, repairEnding: false, footnote: false, tex: false };

const enabled: SmoothConfig = {
  enabled: true,
  ticker: ManualTicker,
  scheduler: StepSmoothScheduler,
};

const closures = new Set<IReadableClosure<Block[]>>();

const collectText = (node: HastRoot | RootContent): string => {
  return node.type === 'text'
    ? node.value
    : 'children' in node
      ? node.children.map(collectText).join('')
      : '';
};

const setup = (initialText = '', initialSmooth?: boolean | SmoothConfig) => {
  const text = MutableState.of(initialText);

  const smooth = MutableState.of(initialSmooth ?? false);

  const core = render(
    S([
      Core<Block>,
      {
        Renderer: D(BlockRenderer),
        text,
        build,
        smooth: initialSmooth === undefined ? undefined : smooth,
        patches: [],
        renders: [],
        rehypes: [ObserveCompilation],
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

  return { core, read, smooth, text, tick };
};

beforeEach(() => {
  ManualTicker.instances = [];

  StepSmoothScheduler.instances = [];

  DoubleStepSmoothScheduler.instances = [];

  compiled.mockClear();
});

afterEach(() => {
  closures.forEach((closure) => closure.destroy());

  closures.clear();

  vi.unstubAllGlobals();
});

describe('Core smooth pipeline', () => {
  test.each([undefined, false, { ticker: ManualTicker, scheduler: StepSmoothScheduler }])(
    'renders updates synchronously when smooth is %j',
    (smooth) => {
      const requestFrame = vi.fn();

      vi.stubGlobal('requestAnimationFrame', requestFrame);

      const view = setup('', smooth);

      expect(view.read()).toEqual([]);

      view.text.next('plain stream');

      expect(view.read()).toEqual(['plain stream']);

      expect(ManualTicker.instances).toHaveLength(0);

      expect(requestFrame).not.toHaveBeenCalled();
    },
  );

  test('reveals compiled HAST without parsing Markdown again on each tick', () => {
    const view = setup('', enabled);

    expect(view.read()).toEqual([]);

    view.text.next('**abc**');

    expect(view.read()).toEqual(['']);

    const compilationCount = compiled.mock.calls.length;

    view.tick(16);

    expect(view.read()).toEqual(['a']);

    expect(first(view.core.value.value)?.value.value).toMatchObject({
      children: [{ tagName: 'p', children: [{ tagName: 'strong', children: [{ value: 'a' }] }] }],
    });

    view.tick(32);

    view.tick(48);

    expect(view.read()).toEqual(['abc']);

    expect(compiled).toHaveBeenCalledTimes(compilationCount);
  });

  test('flushes pending content when disabled and resumes from the visible end', () => {
    const view = setup('', enabled);

    expect(view.read()).toEqual([]);

    view.text.next('abc');

    view.tick(16);

    expect(view.read()).toEqual(['a']);

    const previousTicker = last(ManualTicker.instances)!;

    view.smooth.next(false);

    expect(view.read()).toEqual(['abc']);

    expect(previousTicker.destroyCalls).toBe(1);

    view.smooth.next(enabled);

    view.text.next('abcde');

    expect(view.read()).toEqual(['abc']);

    view.tick(16);

    expect(view.read()).toEqual(['abcd']);
  });

  test('switches ticker and scheduler together without losing visible progress', () => {
    const view = setup('', enabled);

    view.read();

    view.text.next('abcde');

    view.tick(16);

    const previousTicker = last(ManualTicker.instances)!;

    view.smooth.next({
      enabled: true,
      ticker: ReplacementTicker,
      scheduler: DoubleStepSmoothScheduler,
    });

    expect(previousTicker.destroyCalls).toBe(1);

    expect(view.read()).toEqual(['a']);

    view.tick(16);

    expect(view.read()).toEqual(['abc']);

    view.tick(32);

    expect(view.read()).toEqual(['abcde']);
  });

  test('preserves completed block identity across shrink and subsequent growth', () => {
    const view = setup('first\n\nsecond', enabled);

    expect(view.read()).toEqual(['first', 'second']);

    const firstBlock = first(view.core.value.value);

    view.text.next('first\n\ns');

    expect(view.read()).toEqual(['first', 's']);

    view.text.next('first\n\nsecond');

    expect(view.read()).toEqual(['first', 's']);

    for (let timestamp = 16; timestamp <= 80; timestamp += 16) {
      view.tick(timestamp);
    }

    expect(view.read()).toEqual(['first', 'second']);

    expect(first(view.core.value.value)).toBe(firstBlock);
  });

  test('releases its ticker while leaving caller-owned inputs usable', () => {
    const view = setup('', enabled);

    view.read();

    view.text.next('pending');

    const ticker = last(ManualTicker.instances)!;

    view.core.destroy();

    view.core.destroy();

    expect(ticker.destroyCalls).toBe(1);

    expect(view.text.closed).toBe(false);

    expect(view.smooth.closed).toBe(false);

    view.text.next('still usable');

    expect(view.text.value).toBe('still usable');
  });

  test('renders a static smooth document completely and closes the output', () => {
    const core = render(
      S([
        Core<Block>,
        {
          Renderer: D(BlockRenderer),
          text: ReactiveState.of('**ready**'),
          build,
          smooth: enabled,
          patches: [],
          renders: [],
        },
      ]),
    );

    closures.add(core);

    expect(core.value.value.map((block) => collectText(block.value.value))).toEqual(['ready']);

    expect(core.value.closed).toBe(true);

    expect(ManualTicker.instances.every((ticker) => !ticker.running)).toBe(true);
  });
});
