import type { IBlockMeta, IBlockState, IBlockStateCloneParams, IRangeState } from '@fluxdown/types';
import type { Newable } from '@fluxdown/utils';
import type { IReadableClosure } from 'functive';

export type BaseBlockItemInputs<T> = {
  source: IReadableClosure<T>;

  meta: IReadableClosure<IBlockMeta>;

  range?: IReadableClosure<IRangeState | null>;

  mapper?: NonNullable<IBlockStateCloneParams<T>['mapper']>;
};

export type BlockItemClass<T> = Newable<IBlockState<T>, [BaseBlockItemInputs<T>]>;
