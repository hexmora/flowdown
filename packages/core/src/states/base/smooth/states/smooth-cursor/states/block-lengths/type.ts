import type { IReadableClosure } from 'reactive';

import type { IBlockState } from '../../../../../base-block';

export interface BlockLengthsInputs<T> {
  /**
   * Blocks whose base lengths determine the available progress.
   */
  source: IReadableClosure<IBlockState<T>[]>;
}
