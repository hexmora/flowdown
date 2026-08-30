import type { IReactiveState, IStateClosure, StateSource } from '@flowdown/reactive';
import type { IRawPatchItem, IRehypePlugin, IRemarkPlugin } from '@flowdown/types';

import type { HastRoot } from '../../../../typings';
import type { IBlockSection, IBlockState } from '../../../base';

export type { IBlockSection, IRawPatchItem };

export interface IBlockCompilerStateClosure extends IStateClosure<IBlockState<HastRoot>[]> {}

export type IBlockCompilerConfig = {
  repair: boolean;

  repairEnding: boolean;

  footnote: boolean;

  tex: boolean;
};

export type BlockCompilerConfig = IBlockCompilerConfig;

export type BlockRemarksConfig = BlockCompilerConfig & {
  patches: IRawPatchItem[];
};

export type BlockCompilerStateClosureParams = {
  sections: StateSource<IBlockSection[]>;

  config: StateSource<BlockCompilerConfig>;

  getRemarks: (params: IReactiveState<BlockRemarksConfig>) => StateSource<IRemarkPlugin[]>;

  getRehypes: () => StateSource<IRehypePlugin[]>;
};
