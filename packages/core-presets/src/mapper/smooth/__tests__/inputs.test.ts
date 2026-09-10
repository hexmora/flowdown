import type { IBlockState, MapperInputs } from '@flowdown/types';

import {
  type IReadableClosure,
  isOnceFunction,
  MutableState,
  ReactiveState,
  render,
  S,
  toClosure,
} from 'reactive';
import { afterEach, expect, expectTypeOf, test, vi } from 'vitest';

import type { SmoothBaseInputs, SmoothInputs } from '..';
import type { CutoffBlocksInputs, SmoothCursorInputs } from '../states';
import type { SmoothPosition } from '../states/smooth-cursor/states';

import { Smooth } from '..';
import { StepSmoothScheduler } from '../modules/scheduler/__tests__/utils';
import { FakeSmoothTicker, mockAnimationFrames } from '../modules/ticker/__tests__/utils';
import { SmoothCursor } from '../states';
import { createArrayBlock } from './block';

afterEach(() => {
  vi.useRealTimers();

  vi.unstubAllGlobals();
});

test('parent inputs preserve the contracts owned by their child states', () => {
  expectTypeOf<SmoothBaseInputs>().not.toHaveProperty('source');

  expectTypeOf<MapperInputs<{ count: number }, string>>()
    .toHaveProperty('source')
    .toEqualTypeOf<IReadableClosure<string>>();

  expectTypeOf<MapperInputs<{ count: number }, string>>()
    .toHaveProperty('count')
    .toEqualTypeOf<number>();

  expectTypeOf<Required<SmoothInputs<string>>>().toEqualTypeOf<SmoothCursorInputs<string>>();

  expectTypeOf<CutoffBlocksInputs<string>>()
    .toHaveProperty('items')
    .toEqualTypeOf<IReadableClosure<IBlockState<string>[]>>();

  expectTypeOf<CutoffBlocksInputs<string>>()
    .toHaveProperty('end')
    .toEqualTypeOf<IReadableClosure<SmoothPosition>>();

  expectTypeOf<Parameters<typeof SmoothCursor<string>>[0]>().toEqualTypeOf<
    SmoothCursorInputs<string>
  >();

  expect(isOnceFunction(SmoothCursor)).toBe(true);
});

test('Smooth reveals appended content immediately when only its source is provided', () => {
  const source = MutableState.of<IBlockState<number[]>[]>([]);

  const item = createArrayBlock([1, 2, 3]);

  const state = render(S([Smooth<number[]>, { source }]));

  expect(state.value.value).toEqual([]);

  source.next([item.block]);

  expect(state.value.value.map((block) => block.value.value)).toEqual([[1, 2, 3]]);

  item.source.next([1, 2, 3, 4]);

  expect(state.value.value.map((block) => block.value.value)).toEqual([[1, 2, 3, 4]]);

  state.destroy();

  expect(source.closed).toBe(false);

  expect(item.source.closed).toBe(false);

  item.block.destroy();

  item.source.destroy();

  item.meta.destroy();

  source.destroy();
});

test.each([
  { request: true, cancel: true },
  { request: true, cancel: false },
  { request: false, cancel: true },
  { request: false, cancel: false },
])(
  'Smooth supplies its scheduler and an available ticker with RAF request=$request, cancel=$cancel',
  ({ request, cancel }) => {
    vi.useFakeTimers();

    vi.setSystemTime(0);

    vi.stubGlobal('performance', undefined);

    const frames = mockAnimationFrames();

    vi.stubGlobal('requestAnimationFrame', request ? frames.request : undefined);

    vi.stubGlobal('cancelAnimationFrame', cancel ? frames.cancel : undefined);

    const source = MutableState.of<IBlockState<number[]>[]>([]);

    const item = createArrayBlock([1, 2, 3]);

    const state = render(S([Smooth<number[]>, { source, enabled: ReactiveState.of(true) }]));

    expect(state.value.value).toEqual([]);

    source.next([item.block]);

    expect(state.value.value.map((block) => block.value.value)).toEqual([[]]);

    if (request && cancel) {
      expect(frames.request).toHaveBeenCalledOnce();

      frames.frame(1)(1000);
    } else {
      expect(frames.request).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
    }

    expect(state.value.value.map((block) => block.value.value)).toEqual([[1, 2, 3]]);

    state.destroy();

    expect(vi.getTimerCount()).toBe(0);

    item.block.destroy();

    item.source.destroy();

    item.meta.destroy();

    source.destroy();
  },
);

test('SmoothCursor can be constructed lazily and releases only its own resources', () => {
  const source = MutableState.of<IBlockState<number[]>[]>([]);

  const item = createArrayBlock([1, 2, 3]);

  const cursor = render(
    S([
      SmoothCursor<number[]>,
      {
        source: toClosure(source),
        enabled: toClosure(false),
        ticker: toClosure(ReactiveState.of(FakeSmoothTicker)),
        scheduler: toClosure(ReactiveState.of(StepSmoothScheduler)),
      },
    ]),
  );

  source.next([item.block]);

  expect(cursor.value.value).toEqual({ blockIndex: 0, charIndex: 3 });

  item.source.next([1, 2, 3, 4]);

  expect(cursor.value.value).toEqual({ blockIndex: 0, charIndex: 4 });

  cursor.destroy();

  expect(source.closed).toBe(false);

  expect(item.block.baseLength.closed).toBe(false);

  item.block.destroy();

  item.source.destroy();

  item.meta.destroy();

  source.destroy();
});
