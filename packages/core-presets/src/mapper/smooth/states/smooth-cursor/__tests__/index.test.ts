import type { IBlockState } from '@fluxdown/types';

import { expectTypeOf } from 'expect-type';
import {
  BatchScheduler,
  type IReadableClosure,
  mapClosure,
  MutableState,
  ReactiveState,
  render,
  S,
  toClosure,
} from 'functive';

import type { SmoothSchedulerClass } from '../../..';
import type { SmoothPosition } from '../states';

import { SmoothCursor } from '..';
import { ArrayBlock, createArrayBlock } from '../../../__tests__/block';
import { latest, PrimarySmoothTicker, resetSmoothTests } from '../../../__tests__/utils';
import { StepSmoothScheduler } from '../../../modules/scheduler/__tests__/utils';

const setupCursor = (
  initial: IBlockState<number[]>[] = [],
  active = true,
  Scheduler: SmoothSchedulerClass = StepSmoothScheduler,
) => {
  const source = MutableState.of(initial);

  const cursor = render(
    S([
      SmoothCursor<number[]>,
      {
        source: toClosure(source),
        enabled: toClosure(active),
        ticker: toClosure(ReactiveState.of(PrimarySmoothTicker)),
        scheduler: toClosure(ReactiveState.of(Scheduler)),
      },
    ]),
  );

  return { cursor, source };
};

beforeEach(resetSmoothTests);

describe('SmoothCursor', () => {
  test.each([
    { values: [], end: { blockIndex: -1, charIndex: 0 } },
    { values: [[], []], end: { blockIndex: -1, charIndex: 0 } },
    { values: [[1, 2], []], end: { blockIndex: 0, charIndex: 2 } },
    { values: [[], [1, 2], [3]], end: { blockIndex: 2, charIndex: 1 } },
  ])('locates initial progress for $values', ({ values, end }) => {
    const blocks = values.map((value) => createArrayBlock(value).block);

    const { cursor } = setupCursor(blocks);

    expectTypeOf(cursor).toEqualTypeOf<IReadableClosure<SmoothPosition>>();

    expectTypeOf(cursor.value.value).toEqualTypeOf<SmoothPosition>();

    expect(cursor.value.value).toEqual(end);

    cursor.destroy();
  });

  test.each([
    { lengths: [3, 3], step: -1, end: { blockIndex: 0, charIndex: 0 } },
    { lengths: [3, 3], step: 100, end: { blockIndex: 1, charIndex: 3 } },
    { lengths: [3, 3], step: 3, end: { blockIndex: 0, charIndex: 3 } },
    { lengths: [0, 3], step: 0, end: { blockIndex: 0, charIndex: 0 } },
  ])('locates a step of $step in $lengths', ({ lengths, step, end }) => {
    class Scheduler extends StepSmoothScheduler {
      override tick() {
        return step;
      }
    }

    const { cursor, source } = setupCursor([], true, Scheduler);

    expect(cursor.value.value).toEqual({ blockIndex: -1, charIndex: 0 });

    source.next(lengths.map((length) => createArrayBlock(Array<number>(length).fill(0)).block));

    latest(PrimarySmoothTicker.instances).tick(16);

    expect(cursor.value.value).toEqual(end);

    cursor.destroy();
  });

  test('advances across empty blocks and exact boundaries using only block lengths', () => {
    const { cursor, source } = setupCursor();

    expect(cursor.value.value).toEqual({ blockIndex: -1, charIndex: 0 });

    const blocks = [[], [1, 2], [], [3]].map((value) => createArrayBlock(value).block);

    const reads = blocks.map((block) => jest.spyOn(block, 'value', 'get'));

    const forks = blocks.map((block) => jest.spyOn(block, 'fork'));

    source.next(blocks);

    expect(cursor.value.value).toEqual({ blockIndex: 0, charIndex: 0 });

    const ticker = latest(PrimarySmoothTicker.instances);

    ticker.tick(16);

    expect(cursor.value.value).toEqual({ blockIndex: 1, charIndex: 1 });

    ticker.tick(32);

    expect(cursor.value.value).toEqual({ blockIndex: 1, charIndex: 2 });

    ticker.tick(48);

    expect(cursor.value.value).toEqual({ blockIndex: 3, charIndex: 1 });

    for (const operation of [...reads, ...forks]) {
      expect(operation).not.toHaveBeenCalled();
    }

    cursor.destroy();
  });

  test('tracks replacement lengths without emitting an unchanged endpoint', () => {
    const first = createArrayBlock([1, 2]);

    const next = createArrayBlock([3, 4]);

    const { cursor, source } = setupCursor([first.block], false);

    const changed = jest.fn();

    cursor.value.subscribe(changed);

    source.next([next.block]);

    first.source.next([1, 2, 3, 4, 5]);

    expect(changed).toHaveBeenCalledTimes(1);

    next.source.next([3, 4, 5]);

    expect(cursor.value.value).toEqual({ blockIndex: 0, charIndex: 3 });

    expect(changed).toHaveBeenCalledTimes(2);

    cursor.destroy();
  });

  test('preserves absolute progress when block lengths change in one batch', () => {
    const first = createArrayBlock([1, 2, 3, 4, 5]);

    const second = createArrayBlock([6]);

    const { cursor } = setupCursor([first.block, second.block]);

    expect(cursor.value.value).toEqual({ blockIndex: 1, charIndex: 1 });

    BatchScheduler.batch(() => {
      first.source.next([1]);

      second.source.next([2, 3, 4, 5, 6]);
    });

    expect(cursor.value.value).toEqual({ blockIndex: 1, charIndex: 5 });

    cursor.destroy();
  });

  test('waits for differently derived block lengths before applying an atomic edit', () => {
    const first = createArrayBlock([1, 2, 3, 4, 5]);

    const second = createArrayBlock([6]);

    let source = second.block.inputs.source;

    for (let depth = 0; depth < 3; depth++) {
      source = mapClosure(source, (value) => value);
    }

    const derived = new ArrayBlock<number>({ ...second.block.inputs, source });

    const { cursor } = setupCursor([first.block, derived]);

    expect(cursor.value.value).toEqual({ blockIndex: 1, charIndex: 1 });

    BatchScheduler.batch(() => {
      first.source.next([1]);

      second.source.next([2, 3, 4, 5, 6]);
    });

    expect(cursor.value.value).toEqual({ blockIndex: 1, charIndex: 5 });

    cursor.destroy();

    derived.destroy();
  });
});
