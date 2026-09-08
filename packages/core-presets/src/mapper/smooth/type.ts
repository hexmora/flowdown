import type { Newable } from 'reactive';

import type { IScheduler, ITicker } from './modules';
import type { SmoothCursorInputs } from './states';

export interface SmoothInputs<T> extends SmoothCursorInputs<T> {}

export type TickerParams = [interval?: number];

export type SchedulerParams = [tuple?: number[]];

export type TickerType = 'raf' | 'interval';

export type SchedulerType = 'spring';

export type SmoothTickerClass = Newable<ITicker, TickerParams>;

export type SmoothSchedulerClass = Newable<IScheduler, SchedulerParams>;

export interface BaseSmoothConfig {
  /**
   * Whether progressive rendering is enabled.
   */
  enabled: boolean;

  /**
   * Resolved timestamp source constructor.
   */
  ticker: SmoothTickerClass;

  /**
   * Resolved progress scheduler constructor.
   */
  scheduler: SmoothSchedulerClass;
}

export interface SmoothConfig {
  /**
   * Reveal newly compiled content over successive ticks.
   * @default false
   */
  enabled?: boolean;

  /**
   * Built-in timestamp source name or a custom ticker constructor.
   */
  ticker: TickerType | SmoothTickerClass;

  /**
   * Built-in progress scheduler name or a custom scheduler constructor.
   */
  scheduler: SchedulerType | SmoothSchedulerClass;
}
