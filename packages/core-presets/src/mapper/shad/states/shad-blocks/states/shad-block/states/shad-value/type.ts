import type { IBlockState } from '@flowdown/types';
import type { Root as HastRoot } from 'hast';

import type { ShadBlockInputs } from '../../type';

export interface ShadValueInputs extends ShadBlockInputs {
  current: IBlockState<HastRoot>;
}
