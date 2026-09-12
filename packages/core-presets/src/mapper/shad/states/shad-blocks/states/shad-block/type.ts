import type { IBlockState } from '@fluxdown/types';
import type { IReadableClosure } from 'functive';
import type { Root as HastRoot } from 'hast';

import type { ShadPosition } from '../../../shad-progress';

export interface ShadBlockInputs {
  source: IBlockState<HastRoot>;

  tail: IReadableClosure<IBlockState<HastRoot> | undefined>;

  progress: IReadableClosure<ShadPosition>;
}
