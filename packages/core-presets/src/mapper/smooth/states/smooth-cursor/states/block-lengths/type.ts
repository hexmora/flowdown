import type { IBlockState } from '@fluxdown/types';
import type { IReadableClosure } from 'functive';

export interface BlockLengthsInputs<T> {
  /**
   * Blocks whose base lengths determine the available progress.
   */
  source: IReadableClosure<IBlockState<T>[]>;
}
