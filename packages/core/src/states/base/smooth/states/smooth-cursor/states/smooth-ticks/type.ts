import type { IReadableClosure } from 'reactive';

import type { TickerFramesInputs } from './states';

export type { SmoothTick } from './states';

export interface SmoothTicksInputs {
  /**
   * Whether newly appended content advances on ticker events.
   */
  enabled: IReadableClosure<boolean>;

  /**
   * Constructor used to supply animation timestamps.
   */
  ticker: IReadableClosure<TickerFramesInputs['Ticker']>;
}
