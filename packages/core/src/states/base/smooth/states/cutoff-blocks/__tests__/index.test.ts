import type { IReactiveState } from 'reactive';

import { mapClosure, MutableState, render, S, toClosure } from 'reactive';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IBlockState } from '../../../../base-block';
import type { SmoothPosition } from '../../smooth-cursor';

import { ArrayBlock, createArrayBlock } from '../../../__tests__/generic-utils';
import { CutoffBlocks } from '../index';

const setupCutoff = (blocks: IBlockState<number[]>[], position: SmoothPosition) => {
  const items = MutableState.of(blocks);

  const end = MutableState.of(position);

  const state = render(S([CutoffBlocks<number[]>, { items, end }]));

  return { state, items, end };
};

describe('CutoffBlocks', () => {
  test('cuts generic blocks at an inclusive endpoint and retains visible forks', () => {
    const a = createArrayBlock([1, 2], 'a');

    const b = createArrayBlock([3, 4], 'b');

    const { state, end } = setupCutoff([a.block, b.block], { blockIndex: 0, charIndex: 1 });

    expectTypeOf(state.value).toEqualTypeOf<IReactiveState<IBlockState<number[]>[]>>();

    const initial = state.value.value;

    const [first] = initial;

    expect(initial.map((block) => block.value.value)).toEqual([[1]]);

    end.next({ blockIndex: 0, charIndex: 2 });

    expect(state.value.value).toBe(initial);

    expect(first.value.value).toEqual([1, 2]);

    end.next({ blockIndex: 1, charIndex: 1 });

    const output = state.value.value;

    expect(output[0]).toBe(first);

    expect(output.map((block) => block.value.value)).toEqual([[1, 2], [3]]);

    expect(output.map((block) => block.range.value)).toEqual([null, { start: 0, end: 1 }]);

    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);

    expect(a.meta.value.blockCount).toBe(1);

    state.destroy();
  });

  test('honors an empty boundary block without inspecting or forking hidden items', () => {
    const empty = createArrayBlock<number>([]);

    const hidden = createArrayBlock([1, 2]);

    const forkHidden = vi.spyOn(hidden.block, 'fork');

    const { state, end } = setupCutoff([empty.block, hidden.block], {
      blockIndex: -1,
      charIndex: 0,
    });

    expect(state.value.value).toEqual([]);

    end.next({ blockIndex: 0, charIndex: 0 });

    expect(state.value.value.map((block) => block.value.value)).toEqual([[]]);

    expect(state.value.value.map((block) => block.range.value)).toEqual([{ start: 0, end: 0 }]);

    expect(forkHidden).not.toHaveBeenCalled();

    state.destroy();
  });

  test('responds to items independently of the endpoint and releases only owned forks', () => {
    const a = createArrayBlock([1, 2], 'a');

    const b = createArrayBlock([3, 4], 'b');

    const { state, items } = setupCutoff([a.block], { blockIndex: 0, charIndex: 1 });

    const [previous] = state.value.value;

    const meta = previous.meta;

    const range = previous.range;

    const destroy = vi.spyOn(previous, 'destroy');

    items.next([b.block]);

    const [current] = state.value.value;

    expect(current).not.toBe(previous);

    expect(current.value.value).toEqual([3]);

    expect(current.range.value).toEqual({ start: 0, end: 1 });

    expect(destroy).toHaveBeenCalledOnce();

    expect(meta.closed).toBe(true);

    expect(range.closed).toBe(true);

    b.meta.next({ ...b.meta.value, key: 'updated', blockCount: 9 });

    expect(current.meta.value).toEqual({ ...b.meta.value, blockCount: 1 });

    state.destroy();

    state.destroy();

    expect(destroy).toHaveBeenCalledOnce();

    expect(current.meta.closed).toBe(true);

    expect(current.range.closed).toBe(true);

    expect([a.source, a.meta, b.source, b.meta].every((source) => !source.closed)).toBe(true);
  });

  test('retains forks by source identity across reordering and shares the visible count', () => {
    const a = createArrayBlock([1, 2], 'a');

    const b = createArrayBlock([3, 4], 'b');

    const { state, items, end } = setupCutoff([a.block, b.block], {
      blockIndex: 1,
      charIndex: 1,
    });

    const [forkA, forkB] = state.value.value;

    items.next([b.block, a.block]);

    expect(state.value.value).toEqual([forkB, forkA]);

    expect(state.value.value.map((block) => block.value.value)).toEqual([[3, 4], [1]]);

    end.next({ blockIndex: 0, charIndex: 1 });

    expect(state.value.value).toEqual([forkB]);

    expect(forkB.meta.value.blockCount).toBe(1);

    expect(forkA.range.closed).toBe(true);

    state.destroy();
  });

  test('releases previously created forks when a later block fails to initialize', () => {
    const a = createArrayBlock([1, 2], 'a');

    const b = createArrayBlock([3, 4], 'b');

    const failure = new Error('Cannot create block fork.');

    const fork = a.block.fork();

    const destroy = vi.spyOn(fork, 'destroy');

    vi.spyOn(a.block, 'fork').mockReturnValue(fork);

    vi.spyOn(b.block, 'fork').mockImplementation(() => {
      throw failure;
    });

    const { state, items, end } = setupCutoff([a.block, b.block], {
      blockIndex: 1,
      charIndex: 1,
    });

    expect(() => state.value).toThrow(failure);

    expect(destroy).toHaveBeenCalledOnce();

    expect([a.source, a.meta, b.source, b.meta, items, end].every((input) => !input.closed)).toBe(
      true,
    );

    state.destroy();
  });

  test('releases every fork even when a block teardown throws', () => {
    const a = createArrayBlock([1, 2]);

    const b = createArrayBlock([3, 4]);

    const { state } = setupCutoff([a.block, b.block], { blockIndex: 1, charIndex: 1 });

    const [forkA, forkB] = state.value.value;

    const destroyA = forkA.destroy.bind(forkA);

    const failure = new Error('Block cleanup failed.');

    const first = vi.spyOn(forkA, 'destroy').mockImplementation(() => {
      destroyA();

      throw failure;
    });

    const second = vi.spyOn(forkB, 'destroy');

    expect(() => state.destroy()).toThrow('Block cleanup failed.');

    expect(first).toHaveBeenCalledOnce();

    expect(second).toHaveBeenCalledOnce();

    state.destroy();

    expect(first).toHaveBeenCalledOnce();

    expect(second).toHaveBeenCalledOnce();
  });

  test('publishes a new list only after retained forks update their derived metadata', () => {
    const a = createArrayBlock([1, 2]);

    const b = createArrayBlock([3, 4]);

    let meta = toClosure(a.meta);

    for (let depth = 0; depth < 10; depth++) {
      meta = mapClosure(meta, (value) => value);
    }

    const derived = new ArrayBlock<number>({ ...a.block.inputs, meta });

    const { state, end } = setupCutoff([derived, b.block], { blockIndex: 0, charIndex: 2 });

    const counts: number[][] = [];

    state.value.subscribe((blocks) =>
      counts.push(blocks.map((block) => block.meta.value.blockCount)),
    );

    end.next({ blockIndex: 1, charIndex: 1 });

    expect(counts).toEqual([[1], [2, 2]]);

    state.destroy();

    derived.destroy();
  });

  test('waits for already consumed block content before publishing a shortened list', () => {
    const a = createArrayBlock([1, 2]);

    const b = createArrayBlock([3, 4]);

    let source = toClosure(a.source);

    for (let depth = 0; depth < 10; depth++) {
      source = mapClosure(source, (value) => value);
    }

    const derived = new ArrayBlock<number>({ ...a.block.inputs, source });

    const { state, end } = setupCutoff([derived, b.block], { blockIndex: 1, charIndex: 1 });

    const frames: number[][][] = [];

    state.value.subscribe((blocks) => frames.push(blocks.map((block) => block.value.value)));

    end.next({ blockIndex: 0, charIndex: 1 });

    expect(frames).toEqual([[[1, 2], [3]], [[1]]]);

    state.destroy();

    derived.destroy();
  });

  test('keeps block content lazy when only the output list is consumed', () => {
    const { block } = createArrayBlock([1, 2]);

    const fork = block.fork();

    const read = vi.spyOn(fork, 'value', 'get');

    vi.spyOn(block, 'fork').mockReturnValue(fork);

    const { state, end } = setupCutoff([block], { blockIndex: 0, charIndex: 1 });

    expect(state.value.value).toEqual([fork]);

    end.next({ blockIndex: 0, charIndex: 2 });

    expect(read).not.toHaveBeenCalled();

    state.destroy();
  });
});
