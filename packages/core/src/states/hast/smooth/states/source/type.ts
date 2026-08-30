import type { IReactiveState } from '@flowdown/reactive';

import type { HastRoot } from '../../../../../typings';
import type { IBlockState } from '../../../../base';

export type SmoothSourceSnapshot = {
  blocks: IBlockState<HastRoot>[];

  lengths: number[];

  fullIndex: number;
};

export type SmoothSourceStateClosureParams = {
  source: IReactiveState<IBlockState<HastRoot>[]>;
};
