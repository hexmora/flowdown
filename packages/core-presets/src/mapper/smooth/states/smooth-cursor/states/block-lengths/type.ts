import type { IBlockState } from '@flowdown/types';
import type { IReadableClosure } from 'reactive';

export interface BlockLengthsInputs<T> {
  /**
   * Blocks whose base lengths determine the available progress.
   */
  source: IReadableClosure<IBlockState<T>[]>;
}
