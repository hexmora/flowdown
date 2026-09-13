import type { IBlockMeta, IBlockState, IBlockStateCloneParams, IRangeState } from '@flowdown/types';
import type { Newable } from '@flowdown/utils';
import type { IReadableClosure } from 'reactive';

export type BaseBlockItemInputs<T> = {
  source: IReadableClosure<T>;

  meta: IReadableClosure<IBlockMeta>;

  range?: IReadableClosure<IRangeState | null>;

  mapper?: NonNullable<IBlockStateCloneParams<T>['mapper']>;
};

export type BlockItemClass<T> = Newable<IBlockState<T>, [BaseBlockItemInputs<T>]>;
