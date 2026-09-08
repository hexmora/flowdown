import type { IBlockState } from '@flowdown/types';
import type { IReadableClosure } from 'reactive';

export interface CutoffBlockInputs<T> {
  /**
   * Borrowed source block used to create the owned fork.
   */
  source: IBlockState<T>;

  /**
   * Exclusive character boundary, or null to expose the complete block.
   */
  end: IReadableClosure<number | null>;

  /**
   * Number of blocks in the visible list.
   */
  count: IReadableClosure<number>;
}
