import type { IReadableClosure } from 'reactive';

export interface CompletedInputs {
  /**
   * Source whose completion is observed independently of its values.
   */
  source: IReadableClosure<unknown>;
}
