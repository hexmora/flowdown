import type { IReactiveState, IReadableClosure } from 'reactive';

import { expectTypeOf, test } from 'vitest';

import type { HastRoot } from '../../../../typings';
import type { SmoothSchedulerClass, SmoothTickerClass } from '../../../packs';
import type { IBlockState } from '../../base-block';
import type { SmoothInputs } from '../index';

import { setupSmooth } from './utils';

test('Smooth exposes closure inputs and reactive HAST blocks', () => {
  expectTypeOf<SmoothInputs<HastRoot>['source']>().toEqualTypeOf<
    IReadableClosure<IBlockState<HastRoot>[]>
  >();

  expectTypeOf<SmoothInputs<HastRoot>['enabled']>().toEqualTypeOf<IReadableClosure<boolean>>();

  expectTypeOf<SmoothInputs<HastRoot>['ticker']>().toEqualTypeOf<
    IReadableClosure<SmoothTickerClass>
  >();

  expectTypeOf<SmoothInputs<HastRoot>['scheduler']>().toEqualTypeOf<
    IReadableClosure<SmoothSchedulerClass>
  >();

  const { state } = setupSmooth();

  expectTypeOf<typeof state.value>().toEqualTypeOf<IReactiveState<IBlockState<HastRoot>[]>>();

  state.destroy();
});
