import type { IBlockState } from '@flowdown/types';
import type { Root as HastRoot } from 'hast';
import type { IReadableClosure } from 'reactive';

import type { ShadPosition } from '../shad-progress';

export interface ShadBlocksInputs {
  source: IReadableClosure<IBlockState<HastRoot>[]>;

  progress: IReadableClosure<ShadPosition>;
}

export interface ShadBlockEntry {
  closure: IReadableClosure<IBlockState<HastRoot>>;

  block: IBlockState<HastRoot>;
}
