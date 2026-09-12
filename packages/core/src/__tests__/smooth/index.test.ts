import type {
  SmoothInputs,
  SmoothSchedulerClass,
  SmoothTickerClass,
} from '@fluxdown/core-presets/mapper';
import type { IBlockState } from '@fluxdown/types';
import type { IReactiveState, IReadableClosure } from 'functive';

import { expectTypeOf } from 'expect-type';

import type { HastRoot } from '../../typings';

import { setupSmooth } from './utils';

test('Smooth exposes closure inputs and reactive HAST blocks', () => {
  expectTypeOf<SmoothInputs<HastRoot>>()
    .toHaveProperty('source')
    .toEqualTypeOf<IReadableClosure<IBlockState<HastRoot>[]>>();

  expectTypeOf<SmoothInputs<HastRoot>>()
    .toHaveProperty('enabled')
    .toEqualTypeOf<IReadableClosure<boolean>>();

  expectTypeOf<SmoothInputs<HastRoot>>()
    .toHaveProperty('ticker')
    .toEqualTypeOf<IReadableClosure<SmoothTickerClass>>();

  expectTypeOf<SmoothInputs<HastRoot>>()
    .toHaveProperty('scheduler')
    .toEqualTypeOf<IReadableClosure<SmoothSchedulerClass>>();

  const { state } = setupSmooth();

  expectTypeOf<typeof state.value>().toEqualTypeOf<IReactiveState<IBlockState<HastRoot>[]>>();

  state.destroy();
});
