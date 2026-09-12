import type {
  IBlockRawMeta,
  IBlockState,
  IRawPatchItem,
  IRehypePlugin,
  IRemarkPlugin,
} from '@fluxdown/types';
import type { IReadableClosure } from 'functive';

import type { HastRoot } from '../../../typings';
import type { IBlockSection } from '../../base';

export interface IBlockCompiler extends IReadableClosure<IBlockState<HastRoot>[]> {}

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

export type BlockCompilerInputs = {
  sections: IReadableClosure<IBlockSection[]>;

  config: IReadableClosure<BlockCompilerConfig>;

  getRemarks: (params: {
    config: IReadableClosure<BlockRemarksConfig>;
  }) => IReadableClosure<IRemarkPlugin[]>;

  getRehypes: () => IReadableClosure<IRehypePlugin[]>;
};

export type BlockCompilerItem = {
  meta: IBlockRawMeta;

  section: IBlockSection;
};
