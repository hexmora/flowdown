import type {
  SmoothInputs,
  SmoothSchedulerClass,
  SmoothTickerClass,
} from '@flowdown/core-presets/mapper';
import type { IBlockState } from '@flowdown/types';
import type { IReactiveState, IReadableClosure } from 'reactive';

import { expectTypeOf, test } from 'vitest';

import type { HastRoot } from '../../typings';

import { setupSmooth } from './utils';

test('Smooth exposes closure inputs and reactive HAST blocks', () => {
  expectTypeOf<SmoothInputs<HastRoot>>()
    .toHaveProperty('source')
    .toEqualTypeOf<IReadableClosure<IBlockState<HastRoot>[]>>();

  expectTypeOf<Required<SmoothInputs<HastRoot>>>()
    .toHaveProperty('enabled')
    .toEqualTypeOf<IReadableClosure<boolean>>();

  expectTypeOf<Required<SmoothInputs<HastRoot>>>()
    .toHaveProperty('ticker')
    .toEqualTypeOf<IReadableClosure<SmoothTickerClass>>();

  expectTypeOf<Required<SmoothInputs<HastRoot>>>()
    .toHaveProperty('scheduler')
    .toEqualTypeOf<IReadableClosure<SmoothSchedulerClass>>();

  const { state } = setupSmooth();

  expectTypeOf<typeof state.value>().toEqualTypeOf<IReactiveState<IBlockState<HastRoot>[]>>();

  state.destroy();
});
