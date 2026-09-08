import type { IBlockState } from '@flowdown/types';
import type { IReactiveState } from 'reactive';

import { D, MutableState, render, S } from 'reactive';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import { CutoffBlock } from '..';
import { createArrayBlock } from '../../../../../__tests__/block';

describe('CutoffBlock', () => {
  test('returns the owned block itself and follows its range and count independently', () => {
    const { block, source, meta } = createArrayBlock([1, 2, 3]);

    const end = MutableState.of<number | null>(1);

    const count = MutableState.of(2);

    const state = render(S([CutoffBlock<number[]>, { source: D(block), end, count }]));

    expectTypeOf(state.value).toEqualTypeOf<IReactiveState<IBlockState<number[]>>>();

    const fork = state.value.value;

    const output = vi.fn();

    const destroy = vi.spyOn(fork, 'destroy');

    state.value.subscribe(output);

    expect(fork).not.toBe(block);

    expect(fork.value.value).toEqual([1]);

    expect(fork.meta.value.blockCount).toBe(2);

    end.next(2);

    count.next(3);

    expect(fork.value.value).toEqual([1, 2]);

    expect(fork.meta.value.blockCount).toBe(3);

    end.next(null);

    expect(fork.range.value).toBeNull();

    expect(fork.value.value).toEqual([1, 2, 3]);

    expect(output).toHaveBeenCalledOnce();

    state.destroy();

    state.destroy();

    expect(destroy).toHaveBeenCalledOnce();

    expect([source, meta, end, count].every((input) => !input.closed)).toBe(true);
  });
});
