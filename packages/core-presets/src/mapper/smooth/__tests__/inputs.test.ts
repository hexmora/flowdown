import type { IBlockState } from '@flowdown/types';

import {
  type IReadableClosure,
  isOnceFunction,
  MutableState,
  ReactiveState,
  render,
  S,
  toClosure,
} from 'reactive';
import { expect, expectTypeOf, test } from 'vitest';

import type { SmoothInputs } from '..';
import type { CutoffBlocksInputs, SmoothCursorInputs } from '../states';
import type { SmoothPosition } from '../states/smooth-cursor/states';

import { StepSmoothScheduler } from '../modules/scheduler/__tests__/utils';
import { FakeSmoothTicker } from '../modules/ticker/__tests__/utils';
import { SmoothCursor } from '../states';
import { createArrayBlock } from './block';

test('parent inputs preserve the contracts owned by their child states', () => {
  expectTypeOf<SmoothInputs<string>>().toEqualTypeOf<SmoothCursorInputs<string>>();

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
