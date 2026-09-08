import type { ITicker } from '../../../../../../modules';
import type { SmoothTickerClass } from '../../../../../../type';

export interface TickerFramesInputs {
  Ticker: SmoothTickerClass;
}

export interface SmoothTick {
  ticker: ITicker;

  timestamp: number;
}
