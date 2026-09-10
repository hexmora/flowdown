import type { IBlockState, MapperInputs } from '@flowdown/types';
import type { IReadableClosure, Newable } from 'reactive';

import type { IScheduler, ITicker } from './modules';

export interface SmoothBaseInputs {
  /**
   * Whether newly appended content advances on ticker events.
   */
  enabled?: IReadableClosure<boolean>;

  /**
   * Constructor used to supply animation timestamps.
   */
  ticker?: IReadableClosure<SmoothTickerClass>;

  /**
   * Constructor used to determine visible progress per tick.
   */
  scheduler?: IReadableClosure<SmoothSchedulerClass>;
}

export type SmoothInputs<T> = MapperInputs<SmoothBaseInputs, IBlockState<T>[]>;

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
