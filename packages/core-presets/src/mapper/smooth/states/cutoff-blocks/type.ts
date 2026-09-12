import type { IBlockState } from '@fluxdown/types';
import type { IReactiveState, IReadableClosure, MutableState } from 'functive';

import type { SmoothPosition } from '../smooth-cursor/states';

export interface CutoffBlocksInputs<T> {
  /**
   * Blocks whose visible prefix is exposed through owned forks.
   */
  items: IReadableClosure<IBlockState<T>[]>;

  /**
   * Inclusive final block and its exclusive character boundary.
   */
  end: IReadableClosure<SmoothPosition>;
}

export interface CutoffBlockEntry<T> {
  end: MutableState<number | null>;

  closure: IReadableClosure<IBlockState<T>>;

  dependencies: (IBlockState<T> | IReactiveState<unknown>)[];
}
