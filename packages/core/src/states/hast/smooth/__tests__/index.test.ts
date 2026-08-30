import type { IReactiveState, StateSource } from '@flowdown/reactive';
import type { Element, ElementContent, RootContent, Text } from 'hast';

import { mapState, MutableState, ReactiveState } from '@flowdown/reactive';
import { first, last } from 'lodash-es';
import { beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { HastRoot } from '../../../../typings';
import type { IBlockMeta, IBlockState, IRangeState } from '../../../base';
import type { SmoothSchedulerClass, SmoothTickerClass } from '../../../packs';

import { SmoothStateClosure, type SmoothStateClosureParams } from '..';
import { BaseSmoothScheduler } from '../../../../modules';
import { FakeSmoothTicker } from '../../../../modules/smooth-ticker/__tests__/utils';
import { BlockStateClosure } from '../../block';

class PrimarySmoothTicker extends FakeSmoothTicker {
  static instances: PrimarySmoothTicker[] = [];

  constructor() {
    super();

    PrimarySmoothTicker.instances.push(this);
  }
}

class SecondarySmoothTicker extends FakeSmoothTicker {
  static instances: SecondarySmoothTicker[] = [];

  constructor() {
    super();

    SecondarySmoothTicker.instances.push(this);
  }
}

class StepSmoothScheduler extends BaseSmoothScheduler {
  static instances: StepSmoothScheduler[] = [];

  protected readonly defaultTuple = [1];

  readonly startCalls: { index: number; timestamp: number }[] = [];

  private currentIndex = 0;

  constructor() {
    super();

    StepSmoothScheduler.instances.push(this);
  }

  override reset(index = 0) {
    super.reset(index);

    this.currentIndex = index;
  }

  start(timestamp: number, index = 0) {
    this.startCalls.push({ index, timestamp });

    this.reset(index);
  }

  tick(_timestamp: number) {
    const distance = Math.min(this.tuple[0]!, this.fullIndex - this.currentIndex);

    this.currentIndex += distance;

    return distance;
  }
}

class DoubleStepSmoothScheduler extends StepSmoothScheduler {
  static override instances: DoubleStepSmoothScheduler[] = [];

  protected override readonly defaultTuple = [2];

  constructor() {
    super();

    DoubleStepSmoothScheduler.instances.push(this);
  }
}

type TestBlock = {
  block: IBlockState<HastRoot>;

  meta: MutableState<IBlockMeta>;

  source: MutableState<HastRoot>;
};

const root = (children: RootContent[]): HastRoot => ({
  type: 'root',
  children,
});

const text = (value: string): Text => ({
  type: 'text',
  value,
});

const element = (tagName: string, children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

const paragraph = (value: string) => {
  return root([element('p', [text(value)])]);
};

const collectText = (node: HastRoot | RootContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  if ('children' in node) {
    return node.children.map(collectText).join('');
  }

  return '';
};

const createBlock = (key: string, value: HastRoot, currentIndex = 0, blockCount = 1): TestBlock => {
  const source = MutableState.of(value);

  const meta = MutableState.of<IBlockMeta>({
    key,
    sourceText: collectText(value),
    charStart: 0,
    charEnd: collectText(value).length,
    currentIndex,
    blockCount,
  });

  const block = new BlockStateClosure({ source, meta });

  return { block, meta, source };
};

const getObserverCount = (state: IReactiveState<unknown>): number => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

const getLast = <T>(values: T[]): T => {
  const value = last(values);

  if (!value) {
    throw new Error('Expected a constructed test instance.');
  }

  return value;
};

const setupSmoothStateClosure = (
  initialBlocks: IBlockState<HastRoot>[] = [],
  initialEnabled = true,
) => {
  const enabled = MutableState.of(initialEnabled);

  const schedulerType = MutableState.of<SmoothSchedulerClass>(StepSmoothScheduler);

  const source = MutableState.of(initialBlocks);

  const tickerType = MutableState.of<SmoothTickerClass>(PrimarySmoothTicker);

  const scheduler = mapState(schedulerType, (Scheduler) => Scheduler);

  const ticker = mapState(tickerType, (Ticker) => Ticker);

  const state = new SmoothStateClosure({ source, enabled, scheduler, ticker });

  return {
    enabled,
    scheduler,
    schedulerType,
    source,
    state,
    ticker,
    tickerType,
  };
};

beforeEach(() => {
  PrimarySmoothTicker.instances = [];

  SecondarySmoothTicker.instances = [];

  StepSmoothScheduler.instances = [];

  DoubleStepSmoothScheduler.instances = [];
});

describe('SmoothStateClosure types', () => {
  test('accepts HAST block sources and reactive constructor states', () => {
    expectTypeOf<SmoothStateClosureParams['source']>().toEqualTypeOf<
      StateSource<IBlockState<HastRoot>[]>
    >();

    expectTypeOf<SmoothStateClosureParams['ticker']>().toEqualTypeOf<
      ReactiveState<SmoothTickerClass>
    >();

    expectTypeOf<SmoothStateClosureParams['scheduler']>().toEqualTypeOf<
      ReactiveState<SmoothSchedulerClass>
    >();

    expectTypeOf<SmoothStateClosure['value']>().toEqualTypeOf<
      IReactiveState<IBlockState<HastRoot>[]>
    >();
  });
});

describe('SmoothStateClosure behavior', () => {
  test('shows initial blocks through stable forks and keeps the ticker active', () => {
    const firstBlock = createBlock('first', paragraph('abc'), 0, 2);

    const secondBlock = createBlock('second', paragraph('def'), 1, 2);

    const harness = setupSmoothStateClosure([firstBlock.block, secondBlock.block]);

    const output = harness.state.value.value;

    expect(output).toHaveLength(2);
    expect(output[0]).not.toBe(firstBlock.block);
    expect(output[1]).not.toBe(secondBlock.block);
    expect(output.map((block) => collectText(block.value.value))).toEqual(['abc', 'def']);
    expect(output[0]?.range.value).toBeNull();
    expect(output[1]?.range.value).toEqual({ start: 0, end: 3 });
    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);
    expect(firstBlock.meta.value.blockCount).toBe(2);
    expect(secondBlock.meta.value.blockCount).toBe(2);

    const ticker = getLast(PrimarySmoothTicker.instances);

    const scheduler = getLast(StepSmoothScheduler.instances);

    expect(ticker.running).toBe(true);
    expect(scheduler.startCalls).toEqual([{ index: 6, timestamp: 0 }]);

    ticker.tick(16);

    expect(ticker.running).toBe(true);
    expect(harness.state.value.value).toBe(output);

    harness.state.destroy();
  });

  test('maps the global cursor across block boundaries without early exposure', () => {
    const harness = setupSmoothStateClosure();
    const outputLengths: number[] = [];

    harness.state.value.subscribe((blocks) => outputLengths.push(blocks.length));

    const firstBlock = createBlock('first', paragraph('abc'), 0, 2);

    const secondBlock = createBlock('second', paragraph('def'), 1, 2);

    harness.source.next([firstBlock.block, secondBlock.block]);

    const firstFork = first(harness.state.value.value);

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(firstFork).toBeDefined();
    expect(harness.state.value.value).toHaveLength(1);
    expect(firstFork?.range.value).toEqual({ start: 0, end: 0 });
    expect(firstFork?.meta.value.blockCount).toBe(1);
    expect(firstBlock.meta.value.blockCount).toBe(2);

    ticker.tick(16);
    ticker.tick(32);

    expect(harness.state.value.value).toHaveLength(1);
    expect(collectText(firstFork!.value.value)).toBe('ab');
    expect(outputLengths).toEqual([0, 1]);

    ticker.tick(48);

    expect(harness.state.value.value).toHaveLength(1);
    expect(firstFork?.range.value).toEqual({ start: 0, end: 3 });
    expect(outputLengths).toEqual([0, 1]);

    ticker.tick(64);

    const output = harness.state.value.value;

    const secondFork = output[1];

    expect(output).toHaveLength(2);
    expect(output[0]).toBe(firstFork);
    expect(output[0]?.range.value).toBeNull();
    expect(secondFork?.range.value).toEqual({ start: 0, end: 1 });
    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);
    expect(outputLengths).toEqual([0, 1, 2]);

    ticker.tick(80);
    ticker.tick(96);

    expect(harness.state.value.value).toBe(output);
    expect(secondFork?.range.value).toEqual({ start: 0, end: 3 });
    expect(output.map((block) => collectText(block.value.value))).toEqual(['abc', 'def']);
    expect(ticker.running).toBe(true);

    harness.state.destroy();
  });

  test('publishes a new fork after its initial range and metadata are ready', () => {
    const harness = setupSmoothStateClosure();
    const snapshots: { blockCount: number; range: IRangeState | null; text: string }[][] = [];

    harness.state.value.subscribe((blocks) => {
      snapshots.push(
        blocks.map((block) => ({
          blockCount: block.meta.value.blockCount,
          range: block.range.value,
          text: collectText(block.value.value),
        })),
      );
    });

    const block = createBlock('block', paragraph('abc'));

    harness.source.next([block.block]);

    expect(snapshots).toEqual([
      [],
      [
        {
          blockCount: 1,
          range: { start: 0, end: 0 },
          text: '',
        },
      ],
    ]);

    harness.state.destroy();
  });

  test('slices visible HAST units while retaining ancestor structure', () => {
    const harness = setupSmoothStateClosure();

    expect(harness.state.value.value).toEqual([]);

    const block = createBlock(
      'rich',
      root([element('p', [element('strong', [text('abc')]), text(' tail')])]),
    );

    harness.source.next([block.block]);

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(collectText(first(harness.state.value.value)!.value.value)).toBe('');

    ticker.tick(16);

    const sliced = first(harness.state.value.value)!.value.value;

    const paragraphNode = first(sliced.children) as Element;

    const strongNode = first(paragraphNode.children) as Element;

    expect(paragraphNode.tagName).toBe('p');
    expect(strongNode.tagName).toBe('strong');
    expect(collectText(sliced)).toBe('a');

    harness.state.destroy();
  });

  test('applies visible HAST slicing to a fully exposed tail block', () => {
    const value = root([
      element('p', [text('abc')]),
      element('script', [text('hidden')]),
      { type: 'comment', value: 'comment' },
    ]);

    const block = createBlock('block', value);

    const harness = setupSmoothStateClosure([block.block]);

    const output = first(harness.state.value.value)!.value.value;

    expect(output).not.toBe(value);
    expect(collectText(output)).toBe('abc');
    expect(output.children).toEqual([element('p', [text('abc')])]);

    harness.state.destroy();
  });

  test('caps same-block growth without an outer source or output emission', () => {
    const block = createBlock('block', paragraph('ab'));

    const harness = setupSmoothStateClosure([block.block]);
    const outputs: IBlockState<HastRoot>[][] = [];

    harness.state.value.subscribe((value) => outputs.push(value));

    const fork = first(harness.state.value.value);

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(fork?.range.value).toEqual({ start: 0, end: 2 });

    block.source.next(paragraph('abcd'));

    expect(harness.state.value.value).toEqual([fork]);
    expect(collectText(fork!.value.value)).toBe('ab');
    expect(outputs).toHaveLength(1);

    ticker.tick(16);

    expect(harness.state.value.value).toEqual([fork]);
    expect(collectText(fork!.value.value)).toBe('abc');
    expect(outputs).toHaveLength(1);

    block.source.next(paragraph('wxyz'));

    expect(harness.state.value.value).toEqual([fork]);
    expect(collectText(fork!.value.value)).toBe('wxy');
    expect(outputs).toHaveLength(1);

    ticker.tick(32);

    expect(collectText(fork!.value.value)).toBe('wxyz');

    harness.state.destroy();
  });

  test('tracks block growth after its outer source has completed', () => {
    const block = createBlock('block', paragraph('abc'));

    const enabled = MutableState.of(true);

    const scheduler = MutableState.of<SmoothSchedulerClass>(StepSmoothScheduler);

    const ticker = MutableState.of<SmoothTickerClass>(PrimarySmoothTicker);

    const state = new SmoothStateClosure({
      source: [block.block],
      enabled,
      scheduler,
      ticker,
    });

    const fork = first(state.value.value)!;

    const activeTicker = getLast(PrimarySmoothTicker.instances);

    expect(collectText(fork.value.value)).toBe('abc');

    block.source.next(paragraph('abcd'));

    expect(collectText(fork.value.value)).toBe('abc');

    activeTicker.tick(16);

    expect(collectText(fork.value.value)).toBe('abcd');

    state.destroy();
  });

  test('clamps shrinks and schedules later growth from the current cursor', () => {
    const harness = setupSmoothStateClosure();

    expect(harness.state.value.value).toEqual([]);

    const block = createBlock('block', paragraph('abcdefgh'));

    harness.source.next([block.block]);

    const ticker = getLast(PrimarySmoothTicker.instances);

    ticker.tick(16);
    ticker.tick(32);

    const fork = first(harness.state.value.value);

    expect(collectText(fork!.value.value)).toBe('ab');

    block.source.next(paragraph('abcde'));

    expect(collectText(fork!.value.value)).toBe('ab');

    ticker.tick(48);
    ticker.tick(64);
    ticker.tick(80);

    expect(collectText(fork!.value.value)).toBe('abcde');

    block.source.next(paragraph('a'));

    expect(collectText(fork!.value.value)).toBe('a');

    block.source.next(paragraph('abcd'));

    expect(collectText(fork!.value.value)).toBe('a');

    ticker.tick(96);
    ticker.tick(112);
    ticker.tick(128);

    expect(collectText(fork!.value.value)).toBe('abcd');

    harness.state.destroy();
  });

  test('removes owned forks on clear and restarts a new stream from zero', () => {
    const block = createBlock('old', paragraph('old'));

    const harness = setupSmoothStateClosure([block.block]);

    const destroySourceBlock = vi.spyOn(block.block, 'destroy');

    const fork = first(harness.state.value.value)!;

    const destroyFork = vi.spyOn(fork, 'destroy');

    const destroyMeta = vi.spyOn(fork.meta as ReactiveState<IBlockMeta>, 'destroy');

    const destroyRange = vi.spyOn(fork.range as ReactiveState<IRangeState | null>, 'destroy');

    expect(getObserverCount(block.block.baseLength)).toBeGreaterThan(0);

    harness.source.next([]);

    expect(harness.state.value.value).toEqual([]);
    expect(destroyFork).toHaveBeenCalledOnce();
    expect(destroyMeta).toHaveBeenCalledOnce();
    expect(destroyRange).toHaveBeenCalledOnce();
    expect(destroySourceBlock).not.toHaveBeenCalled();
    expect(getObserverCount(block.block.baseLength)).toBe(0);

    const replacement = createBlock('new', paragraph('new'));

    harness.source.next([replacement.block]);

    const replacementFork = first(harness.state.value.value)!;

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(collectText(replacementFork.value.value)).toBe('');
    expect(replacementFork.range.value).toEqual({ start: 0, end: 0 });

    ticker.tick(16);
    ticker.tick(32);
    ticker.tick(48);

    expect(collectText(replacementFork.value.value)).toBe('new');

    harness.state.destroy();
  });

  test('omits an all-zero-length source', () => {
    const block = createBlock('empty', root([]));

    const harness = setupSmoothStateClosure([block.block]);

    expect(harness.state.value.value).toEqual([]);

    harness.state.destroy();
  });

  test('does not expose a positive block behind a leading zero block at cursor zero', () => {
    const harness = setupSmoothStateClosure();

    expect(harness.state.value.value).toEqual([]);

    const emptyBlock = createBlock('empty', root([]), 0, 2);

    const contentBlock = createBlock('content', paragraph('abc'), 1, 2);

    const forkContent = vi.spyOn(contentBlock.block, 'fork');

    harness.source.next([emptyBlock.block, contentBlock.block]);

    const ticker = getLast(PrimarySmoothTicker.instances);

    const initialOutput = harness.state.value.value;

    expect(initialOutput.map((block) => block.meta.value.key)).toEqual(['empty']);
    expect(initialOutput[0]?.range.value).toEqual({ start: 0, end: 0 });
    expect(initialOutput[0]?.meta.value.blockCount).toBe(1);
    expect(forkContent).not.toHaveBeenCalled();

    ticker.tick(16);

    const nextOutput = harness.state.value.value;

    expect(nextOutput.map((block) => block.meta.value.key)).toEqual(['empty', 'content']);
    expect(nextOutput[0]?.range.value).toBeNull();
    expect(nextOutput[1]?.range.value).toEqual({ start: 0, end: 1 });
    expect(nextOutput.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);
    expect(forkContent).toHaveBeenCalledOnce();

    harness.state.destroy();
  });

  test('keeps zero-length blocks behind exact boundaries and derives visible forks lazily', () => {
    const harness = setupSmoothStateClosure();

    expect(harness.state.value.value).toEqual([]);

    const firstBlock = createBlock('first', paragraph('abc'), 0, 3);

    const emptyBlock = createBlock('empty', root([]), 1, 3);

    const lastBlock = createBlock('last', paragraph('de'), 2, 3);

    const forkFirst = vi.spyOn(firstBlock.block, 'fork');

    const forkEmpty = vi.spyOn(emptyBlock.block, 'fork');

    const forkLast = vi.spyOn(lastBlock.block, 'fork');

    harness.source.next([firstBlock.block, emptyBlock.block, lastBlock.block]);

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(forkFirst).toHaveBeenCalledOnce();
    expect(forkEmpty).not.toHaveBeenCalled();
    expect(forkLast).not.toHaveBeenCalled();

    ticker.tick(16);
    ticker.tick(32);
    ticker.tick(48);

    expect(harness.state.value.value.map((block) => block.meta.value.key)).toEqual(['first']);
    expect(forkEmpty).not.toHaveBeenCalled();
    expect(forkLast).not.toHaveBeenCalled();

    ticker.tick(64);

    const output = harness.state.value.value;

    const emptyFork = output[1]!;

    const destroyEmptyFork = vi.spyOn(emptyFork, 'destroy');

    expect(output.map((block) => block.meta.value.key)).toEqual(['first', 'empty', 'last']);
    expect(output[0]?.range.value).toBeNull();
    expect(output[1]?.range.value).toBeNull();
    expect(output[2]?.range.value).toEqual({ start: 0, end: 1 });
    expect(forkEmpty).toHaveBeenCalledOnce();
    expect(forkLast).toHaveBeenCalledOnce();

    ticker.tick(80);

    harness.source.next([firstBlock.block, emptyBlock.block]);

    const finalOutput = harness.state.value.value;

    expect(finalOutput.map((block) => block.meta.value.key)).toEqual(['first']);
    expect(finalOutput[0]?.range.value).toEqual({ start: 0, end: 3 });
    expect(finalOutput[0]?.meta.value.blockCount).toBe(1);
    expect(destroyEmptyFork).toHaveBeenCalledOnce();

    harness.state.destroy();
  });

  test('flushes while disabled and does not rewind when enabled', () => {
    const block = createBlock('block', paragraph('abc'));

    const harness = setupSmoothStateClosure([block.block], false);

    const fork = first(harness.state.value.value)!;

    expect(collectText(fork.value.value)).toBe('abc');
    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    block.source.next(paragraph('abcde'));

    expect(collectText(fork.value.value)).toBe('abcde');

    harness.enabled.next(true);

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(collectText(fork.value.value)).toBe('abcde');
    expect(ticker.running).toBe(true);

    block.source.next(paragraph('abcdefg'));

    expect(collectText(fork.value.value)).toBe('abcde');

    ticker.tick(16);

    expect(collectText(fork.value.value)).toBe('abcdef');

    harness.enabled.next(false);

    expect(collectText(fork.value.value)).toBe('abcdefg');
    expect(fork.range.value).toEqual({ start: 0, end: 7 });
    expect(ticker.running).toBe(false);

    harness.state.destroy();
  });

  test('flushes every pending block and updates output metadata when disabled', () => {
    const harness = setupSmoothStateClosure();

    expect(harness.state.value.value).toEqual([]);

    const firstBlock = createBlock('first', paragraph('abc'), 0, 2);

    const secondBlock = createBlock('second', paragraph('def'), 1, 2);

    harness.source.next([firstBlock.block, secondBlock.block]);

    const ticker = getLast(PrimarySmoothTicker.instances);

    ticker.tick(16);

    expect(harness.state.value.value).toHaveLength(1);
    expect(collectText(first(harness.state.value.value)!.value.value)).toBe('a');

    harness.enabled.next(false);

    const output = harness.state.value.value;

    expect(output.map((block) => collectText(block.value.value))).toEqual(['abc', 'def']);
    expect(output[0]?.range.value).toBeNull();
    expect(output[1]?.range.value).toEqual({ start: 0, end: 3 });
    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);
    expect(ticker.running).toBe(false);

    harness.state.destroy();
  });

  test('switches ticker and scheduler constructors without replacing visible forks', () => {
    const harness = setupSmoothStateClosure();

    expect(harness.state.value.value).toEqual([]);

    const block = createBlock('block', paragraph('abcd'));

    harness.source.next([block.block]);

    const primaryTicker = getLast(PrimarySmoothTicker.instances);

    primaryTicker.tick(16);

    const fork = first(harness.state.value.value)!;

    expect(collectText(fork.value.value)).toBe('a');

    harness.tickerType.next(SecondarySmoothTicker);

    const secondaryTicker = getLast(SecondarySmoothTicker.instances);

    expect(primaryTicker.destroyCalls).toBe(1);
    expect(secondaryTicker.running).toBe(true);
    expect(first(harness.state.value.value)).toBe(fork);
    expect(collectText(fork.value.value)).toBe('a');

    secondaryTicker.tick(16);

    expect(collectText(fork.value.value)).toBe('ab');

    harness.schedulerType.next(DoubleStepSmoothScheduler);

    expect(DoubleStepSmoothScheduler.instances).toHaveLength(1);
    expect(first(harness.state.value.value)).toBe(fork);

    secondaryTicker.tick(32);

    expect(collectText(fork.value.value)).toBe('abcd');

    harness.state.destroy();
  });

  test('destroys owned resources and subscriptions without closing input blocks', () => {
    const block = createBlock('block', paragraph('value'));

    const harness = setupSmoothStateClosure([block.block]);

    const destroySourceBlock = vi.spyOn(block.block, 'destroy');

    const subscription = harness.state.value.subscribe(() => undefined);

    const fork = first(harness.state.value.value)!;

    const destroyFork = vi.spyOn(fork, 'destroy');

    const destroyMeta = vi.spyOn(fork.meta as ReactiveState<IBlockMeta>, 'destroy');

    const destroyRange = vi.spyOn(fork.range as ReactiveState<IRangeState | null>, 'destroy');

    const ticker = getLast(PrimarySmoothTicker.instances);

    expect(getObserverCount(harness.source)).toBeGreaterThan(0);
    expect(getObserverCount(harness.enabled)).toBeGreaterThan(0);
    expect(getObserverCount(harness.ticker)).toBeGreaterThan(0);
    expect(getObserverCount(harness.scheduler)).toBeGreaterThan(0);
    expect(getObserverCount(block.block.baseLength)).toBeGreaterThan(0);

    harness.state.destroy();
    harness.state.destroy();

    expect(subscription.closed).toBe(true);
    expect(ticker.destroyCalls).toBe(1);
    expect(destroyFork).toHaveBeenCalledOnce();
    expect(destroyMeta).toHaveBeenCalledOnce();
    expect(destroyRange).toHaveBeenCalledOnce();
    expect(destroySourceBlock).not.toHaveBeenCalled();
    expect(block.source.closed).toBe(false);
    expect(block.meta.closed).toBe(false);
    expect(harness.source.closed).toBe(false);
    expect(harness.enabled.closed).toBe(false);
    expect(harness.ticker.closed).toBe(false);
    expect(harness.scheduler.closed).toBe(false);
    expect(getObserverCount(harness.source)).toBe(0);
    expect(getObserverCount(harness.enabled)).toBe(0);
    expect(getObserverCount(harness.ticker)).toBe(0);
    expect(getObserverCount(harness.scheduler)).toBe(0);
    expect(getObserverCount(block.block.baseLength)).toBe(0);
  });

  test('destroy before initialization creates no runtime or forks', () => {
    const block = createBlock('block', paragraph('value'));

    const harness = setupSmoothStateClosure([block.block]);

    const destroySourceBlock = vi.spyOn(block.block, 'destroy');

    expect(getObserverCount(harness.source)).toBe(0);
    expect(getObserverCount(harness.enabled)).toBe(0);
    expect(getObserverCount(harness.ticker)).toBe(0);
    expect(getObserverCount(harness.scheduler)).toBe(0);

    harness.state.destroy();
    harness.state.destroy();

    expect(PrimarySmoothTicker.instances).toHaveLength(0);
    expect(StepSmoothScheduler.instances).toHaveLength(0);
    expect(destroySourceBlock).not.toHaveBeenCalled();
    expect(() => harness.state.value).toThrowError('Cannot set up a destroyed state closure.');
  });
});
