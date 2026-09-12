import type { IReadableClosure } from 'functive';

export interface CompletedInputs {
  /**
   * Source whose completion is observed independently of its values.
   */
  source: IReadableClosure<unknown>;
}
