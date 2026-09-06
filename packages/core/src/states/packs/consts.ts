import type { SmoothSchedulerClass, SmoothTickerClass } from './type';

import { IntervalSmoothTicker, RafSmoothTicker, SpringSmoothScheduler } from '../../externals';

export const ALL_TICKERS: SmoothTickerClass[] = [RafSmoothTicker, IntervalSmoothTicker];

export const ALL_SCHEDULERS: SmoothSchedulerClass[] = [SpringSmoothScheduler];
