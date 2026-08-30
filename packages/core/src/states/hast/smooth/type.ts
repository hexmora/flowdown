import type { ReactiveState, StateSource } from '@flowdown/reactive';

import type { HastRoot } from '../../../typings';
import type { IBlockState } from '../../base';
import type { SmoothSchedulerClass, SmoothTickerClass } from '../../packs/type';

export type SmoothStateClosureParams = {
  source: StateSource<IBlockState<HastRoot>[]>;

  enabled: StateSource<boolean>;

  ticker: ReactiveState<SmoothTickerClass>;

  scheduler: ReactiveState<SmoothSchedulerClass>;
};
