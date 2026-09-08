import type { SmoothSchedulerClass, SmoothTickerClass } from '@flowdown/core-presets/mapper';

import {
  IntervalSmoothTicker,
  RafSmoothTicker,
  SpringSmoothScheduler,
} from '@flowdown/core-presets/mapper';

export const ALL_TICKERS: SmoothTickerClass[] = [RafSmoothTicker, IntervalSmoothTicker];

export const ALL_SCHEDULERS: SmoothSchedulerClass[] = [SpringSmoothScheduler];
