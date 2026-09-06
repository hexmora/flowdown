import type { ElementContent, Parent, RootContent } from 'hast';

import { assert } from '@flowdown/utils';
import { first, last, reverse, take } from 'lodash-es';
import {
  D,
  type IReadableClosure,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  useClearable,
  useMap,
} from 'reactive';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../../typings';
import type { IBlockState, MapperInputs, MapperPluggable } from '../../base';
import type { CoreMappers, SmoothConfig } from '../type';

import { BaseRenderer } from '../../../externals';
import { StepSmoothScheduler } from '../../../externals/smooth-scheduler/__tests__/utils';
import { FakeSmoothTicker } from '../../../externals/smooth-ticker/__tests__/utils';
import { Smooth } from '../../base';
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

const Reverse = once(function Reverse({ source }: MapperInputs): IReadableClosure<Block[]> {
  return useMap(source, (blocks) => reverse([...blocks]));
});

const TakeFirst = once(function TakeFirst({ source }: MapperInputs): IReadableClosure<Block[]> {
  return useMap(source, (blocks) => take(blocks, 1));
});

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

const setup = (
  initialText: string,
  initialMappers: CoreMappers,
  smooth: boolean | SmoothConfig = false,
) => {
  const text = MutableState.of(initialText);

  const mappers = MutableState.of(initialMappers);

  const core = render(
    S([
      Core<Block>,
      {
        Renderer: D(BlockRenderer),
        text,
        mappers,
        build,
        smooth: ReactiveState.of(smooth),
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

  return { core, read, mappers, text, tick };
};

beforeEach(() => {
  ManualTicker.instances = [];

  StepSmoothScheduler.instances = [];
});

afterEach(() => {
  closures.forEach((closure) => closure.destroy());

  closures.clear();
});

describe('Core mapper pipeline', () => {
  test('exposes the configured default Smooth mapper to a replacement callback', () => {
    const configure = vi.fn((_defaults: MapperPluggable[]) => []);

    const view = setup('start', configure, enabled);

    expect(view.read()).toEqual(['start']);

    expect(configure).toHaveBeenCalledWith([
      [
        Smooth,
        expect.objectContaining({
          enabled: expect.anything(),
          ticker: expect.anything(),
          scheduler: expect.anything(),
        }),
      ],
    ]);

    view.text.next('complete immediately');

    expect(view.read()).toEqual(['complete immediately']);

    expect(ManualTicker.instances).toHaveLength(0);
  });

  test('appends array mappers after Smooth and receives its progressive output', () => {
    const view = setup('first\n\nsecond', [Reverse], enabled);

    expect(view.read()).toEqual(['second', 'first']);

    view.text.next('first\n\nsecond!');

    expect(view.read()).toEqual(['second', 'first']);

    view.tick(16);

    expect(view.read()).toEqual(['second!', 'first']);
  });

  test('switches between arrays and callbacks while respecting mapper order and source updates', () => {
    const view = setup('first\n\nsecond\n\nthird', [Reverse]);

    expect(view.read()).toEqual(['third', 'second', 'first']);

    view.mappers.next((defaults) => [TakeFirst, ...defaults, Reverse]);

    expect(view.read()).toEqual(['first']);

    view.mappers.next((defaults) => [Reverse, ...defaults, TakeFirst]);

    expect(view.read()).toEqual(['third']);

    view.mappers.next([]);

    expect(view.read()).toEqual(['first', 'second', 'third']);

    view.text.next('replacement\n\nlast');

    expect(view.read()).toEqual(['replacement', 'last']);
  });

  test('preserves the compiler and Smooth progress when appending mappers and releases removed stages', () => {
    const destroyed = vi.fn();

    const sources: IReadableClosure<Block[]>[] = [];

    const Observe = once(function Observe({ source }: MapperInputs): IReadableClosure<Block[]> {
      sources.push(source);

      useClearable(destroyed);

      return source;
    });

    const view = setup('', (defaults) => [Observe, ...defaults], enabled);

    expect(view.read()).toEqual([]);

    const compiler = first(sources)!;

    view.text.next('abc');

    const compilerBlock = first(compiler.value.value);

    view.tick(16);

    expect(view.read()).toEqual(['a']);

    const ticker = last(ManualTicker.instances)!;

    view.mappers.next((defaults) => [Observe, ...defaults, Reverse]);

    expect(view.read()).toEqual(['a']);

    expect(sources).toEqual([compiler]);

    expect(first(compiler.value.value)).toBe(compilerBlock);

    expect(ManualTicker.instances).toEqual([ticker]);

    expect(ticker.destroyCalls).toBe(0);

    expect(destroyed).not.toHaveBeenCalled();

    view.tick(32);

    expect(view.read()).toEqual(['ab']);

    view.mappers.next(() => []);

    expect(view.read()).toEqual(['abc']);

    expect(first(view.core.value.value)).toBe(compilerBlock);

    expect(ticker.destroyCalls).toBe(1);

    expect(destroyed).toHaveBeenCalledTimes(1);

    view.core.destroy();

    view.core.destroy();

    expect(ticker.destroyCalls).toBe(1);

    expect(destroyed).toHaveBeenCalledTimes(1);

    expect(view.text.closed).toBe(false);

    expect(view.mappers.closed).toBe(false);

    view.text.next('still usable');

    view.mappers.next([Reverse]);

    expect(view.text.value).toBe('still usable');

    expect(view.mappers.value).toEqual([Reverse]);
  });
});
