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

import type { HastRoot } from '../../../../typings';
import type { IBlockState } from '../../base-block';
import type { SmoothInputs } from '../index';
import type { CutoffBlocksInputs, SmoothCursorInputs, SmoothPosition } from '../states';

import { StepSmoothScheduler } from '../../../../externals/smooth-scheduler/__tests__/utils';
import { FakeSmoothTicker } from '../../../../externals/smooth-ticker/__tests__/utils';
import { SmoothCursor } from '../states/smooth-cursor';
import { createBlock, paragraph } from './utils';

test('parent inputs preserve the contracts owned by their child states', () => {
  expectTypeOf<SmoothInputs<string>>().toEqualTypeOf<SmoothCursorInputs<string>>();

  expectTypeOf<CutoffBlocksInputs<string>['items']>().toEqualTypeOf<
    IReadableClosure<IBlockState<string>[]>
  >();

  expectTypeOf<CutoffBlocksInputs<string>['end']>().toEqualTypeOf<
    IReadableClosure<SmoothPosition>
  >();

  expectTypeOf<Parameters<typeof SmoothCursor<string>>[0]>().toEqualTypeOf<
    SmoothCursorInputs<string>
  >();

  expect(isOnceFunction(SmoothCursor)).toBe(true);
});

test('SmoothCursor can be constructed lazily and releases only its own resources', () => {
  const source = MutableState.of<IBlockState<HastRoot>[]>([]);

  const item = createBlock('first', paragraph('one'));

  const cursor = render(
    S([
      SmoothCursor<HastRoot>,
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

  item.source.next(paragraph('more'));

  expect(cursor.value.value).toEqual({ blockIndex: 0, charIndex: 4 });

  cursor.destroy();

  expect(source.closed).toBe(false);

  expect(item.block.baseLength.closed).toBe(false);

  item.block.destroy();

  item.source.destroy();

  item.meta.destroy();

  source.destroy();
});
