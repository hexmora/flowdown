import type { IReadableClosure } from 'functive';

import type { SmoothTickerClass } from '../../../../type';

export interface SmoothTicksInputs {
  lengths: IReadableClosure<number[]>;

  /**
   * Whether newly appended content advances on ticker events.
   */
  enabled: IReadableClosure<boolean>;

  /**
   * Constructor used to supply animation timestamps.
   */
  ticker: IReadableClosure<SmoothTickerClass>;
}
