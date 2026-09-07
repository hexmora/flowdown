import type { IBlockState } from '@flowdown/types';
import type { Root as HastRoot } from 'hast';
import type { IReadableClosure } from 'reactive';

import type { ShadPosition } from '../../../shad-progress';

export interface ShadBlockInputs {
  source: IBlockState<HastRoot>;

  tail: IReadableClosure<IBlockState<HastRoot> | undefined>;

  progress: IReadableClosure<ShadPosition>;
}
