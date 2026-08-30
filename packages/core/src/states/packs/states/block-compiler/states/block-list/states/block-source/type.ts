import type { IReactiveState, StateSource } from '@flowdown/reactive';
import type { IRehypePlugin, IRemarkPlugin } from '@flowdown/types';

import type { BlockCompilerConfig, BlockRemarksConfig } from '../../../../type';
import type { BlockListItemContext } from '../../type';

export type BlockSourceStateClosureParams = {
  config: StateSource<BlockCompilerConfig>;

  context: IReactiveState<BlockListItemContext>;

  getRehypes: () => StateSource<IRehypePlugin[]>;

  getRemarks: (config: IReactiveState<BlockRemarksConfig>) => StateSource<IRemarkPlugin[]>;
};
