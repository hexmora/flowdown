import type { ITicker } from '../../../../../../../../../externals';
import type { SmoothTickerClass } from '../../../../../../../../packs';

export interface TickerFramesInputs {
  Ticker: SmoothTickerClass;
}

export interface SmoothTick {
  ticker: ITicker;

  timestamp: number;
}
