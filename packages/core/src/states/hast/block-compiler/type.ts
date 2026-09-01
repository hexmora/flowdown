import type { IRawPatchItem, IRehypePlugin, IRemarkPlugin } from '@flowdown/types';
import type { OmitWithType } from '@flowdown/utils';
import type { IReactiveState, IStateClosure, MutableState, StateSource } from 'reactive';

import type { HastRoot } from '../../../typings';
import type { IBlockMeta, IBlockSection, IBlockState } from '../../base';
import type { BlockStateClosure } from '../block';

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

export type BlockCompilerStateClosureInputs = {
  sections: StateSource<IBlockSection[]>;

  config: StateSource<BlockCompilerConfig>;

  getRemarks: (params: IReactiveState<BlockRemarksConfig>) => StateSource<IRemarkPlugin[]>;

  getRehypes: () => StateSource<IRehypePlugin[]>;
};

export type MutableBlockMeta = OmitWithType<IBlockMeta, 'sourceText' | 'key'>;

export type BlockClosure = {
  destroy(): void;

  meta: MutableState<MutableBlockMeta>;

  section: MutableState<IBlockSection>;

  state: BlockStateClosure;
};

export type CreateBlockClosure = (inputs: {
  charStart: number;

  count: number;

  index: number;

  section: IBlockSection;
}) => BlockClosure;
