import type { IReadableClosure } from 'reactive';

import type { SmoothSchedulerClass } from '../../../../../../packs';
import type { SmoothTick, SmoothTicksInputs } from '../smooth-ticks';

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
