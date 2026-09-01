import { IReactiveState, IStateClosure, Newable } from 'reactive';

import { IRangeState } from '../range';

export type BaseBlockStateClosureInputs<T> = {
  source: IReactiveState<T>;

  meta: IReactiveState<IBlockMeta>;

  range?: IReactiveState<IRangeState | null>;

  mapper?: IBlockStateMapper<T>;
};

export type BlockStateClosureClass<T> = Newable<IBlockState<T>, [BaseBlockStateClosureInputs<T>]>;

export interface IBlockMeta {
  /** Unique block identifier */
  key: string;

  /** Text that the block slice belongs to */
  sourceText: string;

  /** Start index of the block slice text */
  charStart: number;

  /** End index of the block slice text */
  charEnd: number;

  /** Index of the block in the full list */
  currentIndex: number;

  /** Length of the list containing the block */
  blockCount: number;
}

export interface IBlockStateMapper<T> {
  (value: IReactiveState<T>, current: IBlockState<T>): IReactiveState<T>;
}

export interface IBlockStateCloneParams<T> {
  /**
   * Context
   */
  meta?: IReactiveState<IBlockMeta>;

  /**
   * Range
   */
  range?: IReactiveState<IRangeState | null>;

  /**
   * Content mapper
   */
  mapper?: IBlockStateMapper<T>;
}

export interface IBlockState<T> extends IStateClosure<T> {
  /** Text length of the built output */
  length: IReactiveState<number>;

  /** Text length of the base value, unaffected by slicing */
  baseLength: IReactiveState<number>;

  /** Reactive block context based on the content before slicing */
  meta: IReactiveState<IBlockMeta>;

  /** Sliced range */
  range: IReactiveState<IRangeState | null>;

  /** Fork a state instance from the current source */
  fork: (params?: IBlockStateCloneParams<T>) => IBlockState<T>;
}
