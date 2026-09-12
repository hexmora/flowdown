import type { IReadableClosure } from 'functive';

import type { SmoothSchedulerClass } from '../../../../type';
import type { SmoothTicksInputs } from '../smooth-ticks';
import type { SmoothTick } from '../smooth-ticks/states';

export interface CursorPositionInputs extends SmoothTicksInputs {
  lengths: IReadableClosure<number[]>;

  /**
   * Constructor used to determine visible progress per tick.
   */
  scheduler: IReadableClosure<SmoothSchedulerClass>;

  ticks: IReadableClosure<SmoothTick | null>;
}

export interface SmoothPosition {
  /**
   * Inclusive index of the last visible block, or -1 when no text units are available.
   */
  blockIndex: number;

  /**
   * End offset in the last visible block, measured in its base-length units.
   */
  charIndex: number;
}
