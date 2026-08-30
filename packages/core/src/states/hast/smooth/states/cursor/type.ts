import type { IReactiveState } from '@flowdown/reactive';

import type { SmoothSchedulerClass, SmoothTickerClass } from '../../../../packs/type';
import type { SmoothSourceSnapshot } from '../source';

export type SmoothCursorFrame = SmoothSourceSnapshot & {
  cursor: number;
};

export type SmoothCursorStateClosureParams = {
  source: IReactiveState<SmoothSourceSnapshot>;

  enabled: IReactiveState<boolean>;

  ticker: IReactiveState<SmoothTickerClass>;

  scheduler: IReactiveState<SmoothSchedulerClass>;
};
