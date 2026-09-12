import { BatchScheduler, MutableState, ReactiveState, render, S } from 'functive';

import { BlockLengths } from '..';
import { createArrayBlock } from '../../../../../__tests__/block';
import { observerCount } from '../../../../../__tests__/utils';

describe('BlockLengths', () => {
  test('keeps observing block lengths after the source list completes', () => {
    const block = createArrayBlock([1, 2]);

    const source = ReactiveState.of([block.block]);

    const state = render(S([BlockLengths<number[]>, { source }]));

    const complete = jest.fn();

    state.value.subscribe({ complete });

    expect(state.value.value).toEqual([2]);

    block.source.next([1, 2, 3]);

    expect(state.value.value).toEqual([3]);

    expect(complete).not.toHaveBeenCalled();

    block.source.complete();

    expect(complete).toHaveBeenCalledTimes(1);

    state.destroy();
  });

  test('replaces subscriptions even when a new source has the same lengths', () => {
    const a = createArrayBlock([1, 2]);

    const b = createArrayBlock([3, 4]);

    const source = MutableState.of([a.block]);

    const state = render(S([BlockLengths<number[]>, { source }]));

    const changed = jest.fn();

    state.value.subscribe(changed);

    source.next([b.block]);

    expect(changed).toHaveBeenCalledTimes(1);

    expect(observerCount(a.block.baseLength)).toBe(0);

    expect(observerCount(b.block.baseLength)).toBeGreaterThan(0);

    a.source.next([1, 2, 3, 4]);

    expect(changed).toHaveBeenCalledTimes(1);

    b.source.next([3, 4, 5]);

    expect(state.value.value).toEqual([3]);

    state.destroy();

    expect(observerCount(b.block.baseLength)).toBe(0);

    expect(source.closed).toBe(false);
  });

  test('publishes only the final length vector of an atomic edit', () => {
    const a = createArrayBlock([1, 2, 3]);

    const b = createArrayBlock([4]);

    const source = MutableState.of([a.block, b.block]);

    const state = render(S([BlockLengths<number[]>, { source }]));

    const frames: number[][] = [];

    state.value.subscribe((lengths) => frames.push(lengths));

    BatchScheduler.batch(() => {
      a.source.next([1]);

      b.source.next([2, 3, 4]);
    });

    expect(frames).toEqual([
      [3, 1],
      [1, 3],
    ]);

    state.destroy();
  });

  test('forwards a block error and immediately releases every length subscription', () => {
    const a = createArrayBlock([1, 2]);

    const b = createArrayBlock([3, 4]);

    const source = MutableState.of([a.block, b.block]);

    const state = render(S([BlockLengths<number[]>, { source }]));

    const error = jest.fn();

    state.value.subscribe({ error });

    const failure = new Error('Cannot read block length.');

    a.source.error(failure);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(failure);

    expect(observerCount(b.block.baseLength)).toBe(0);

    expect(source.closed).toBe(false);

    state.destroy();

    expect(observerCount(source)).toBe(0);
  });

  test('initializes from a pending source update and keeps observing the committed blocks', () => {
    const a = createArrayBlock([1]);

    const b = createArrayBlock([2, 3]);

    const source = MutableState.of([a.block]);

    const state = render(S([BlockLengths<number[]>, { source }]));

    BatchScheduler.batch(() => {
      source.next([b.block]);

      expect(state.value.value).toEqual([2]);
    });

    expect(observerCount(a.block.baseLength)).toBe(0);

    b.source.next([2, 3, 4]);

    expect(state.value.value).toEqual([3]);

    state.destroy();
  });

  test('initializes from a pending base length without replacing it with the committed value', () => {
    const { block } = createArrayBlock([1]);

    const length = MutableState.of(1);

    jest.spyOn(block, 'baseLength', 'get').mockReturnValue(length);

    const source = ReactiveState.of([block]);

    const state = render(S([BlockLengths<number[]>, { source }]));

    BatchScheduler.batch(() => {
      length.next(3);

      expect(state.value.value).toEqual([3]);
    });

    length.next(4);

    expect(state.value.value).toEqual([4]);

    state.destroy();
  });
});
