import type { IReactiveState } from 'reactive';

import { BatchScheduler, mapClosure, MutableState, ReactiveState, render, S } from 'reactive';
import { beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IBlockState } from '../../base-block';

import { StepSmoothScheduler } from '../../../../externals/smooth-scheduler/__tests__/utils';
import { Smooth } from '../index';
import { ArrayBlock, createArrayBlock } from './generic-utils';
import { latest, PrimarySmoothTicker, resetSmoothTests } from './utils';

const setupSmooth = (initial: IBlockState<number[]>[] = []) => {
  const source = MutableState.of(initial);

  const state = render(
    S([
      Smooth<number[]>,
      {
        source,
        enabled: ReactiveState.of(true),
        ticker: ReactiveState.of(PrimarySmoothTicker),
        scheduler: ReactiveState.of(StepSmoothScheduler),
      },
    ]),
  );

  return { state, source };
};

beforeEach(resetSmoothTests);

describe('Smooth generic blocks', () => {
  test('smooths opaque data through the block slicing implementation', () => {
    const { state, source } = setupSmooth();

    expectTypeOf(state.value).toEqualTypeOf<IReactiveState<IBlockState<number[]>[]>>();

    expect(state.value.value).toEqual([]);

    source.next([createArrayBlock([1, 2, 3]).block]);

    const output = state.value.value;

    expect(output.map((block) => block.value.value)).toEqual([[]]);

    latest(PrimarySmoothTicker.instances).tick(16);

    expect(state.value.value).toBe(output);

    expect(output.map((block) => block.value.value)).toEqual([[1]]);

    state.destroy();
  });

  test('replaces blocks when the endpoint stays unchanged', () => {
    const first = createArrayBlock([1, 2]);

    const replacement = createArrayBlock([3, 4]);

    const { state, source } = setupSmooth([first.block]);

    const [previous] = state.value.value;

    const destroy = vi.spyOn(previous, 'destroy');

    source.next([replacement.block]);

    const [current] = state.value.value;

    expect(current).not.toBe(previous);

    expect(current.value.value).toEqual([3, 4]);

    expect(current.range.value).toEqual({ start: 0, end: 2 });

    expect(destroy).toHaveBeenCalledOnce();

    state.destroy();
  });

  test('publishes newly introduced derived blocks after their lengths settle', () => {
    const a = createArrayBlock([1, 2, 3, 4, 5], 'a');

    const b = createArrayBlock([6], 'b');

    const { state, source } = setupSmooth([a.block, b.block]);

    let input = b.block.inputs.source;

    for (let depth = 0; depth < 3; depth++) {
      input = mapClosure(input, (value) => value);
    }

    const derived = new ArrayBlock<number>({ ...b.block.inputs, source: input });

    expect(derived.baseLength.value).toBe(1);

    const snapshots: number[][][] = [];

    state.value.subscribe((blocks) => snapshots.push(blocks.map((block) => block.value.value)));

    BatchScheduler.batch(() => {
      source.next([a.block, derived]);

      a.source.next([1]);

      b.source.next([2, 3, 4, 5, 6]);
    });

    expect(snapshots).toEqual([
      [[1, 2, 3, 4, 5], [6]],
      [[1], [2, 3, 4, 5, 6]],
    ]);

    state.destroy();

    derived.destroy();
  });

  test.each([false, true])(
    'publishes replacement blocks with the current cursor (batched: %s)',
    (batched) => {
      const a = createArrayBlock([1, 2], 'a');

      const b = createArrayBlock([3, 4], 'b');

      const replacement = createArrayBlock([5], 'replacement');

      const { state, source } = setupSmooth([a.block, b.block]);

      const snapshots: unknown[] = [];

      state.value.subscribe((blocks) => {
        snapshots.push(
          blocks.map((block) => ({
            value: block.value.value,
            range: block.range.value,
            count: block.meta.value.blockCount,
          })),
        );
      });

      const update = () => source.next([replacement.block]);

      if (batched) {
        BatchScheduler.batch(update);
      } else {
        update();
      }

      expect(snapshots).toEqual([
        [
          { value: [1, 2], range: null, count: 2 },
          { value: [3, 4], range: { start: 0, end: 2 }, count: 2 },
        ],
        [{ value: [5], range: { start: 0, end: 1 }, count: 1 }],
      ]);

      state.destroy();
    },
  );
});
