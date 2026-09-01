import type { IReactiveState, Newable } from 'reactive';

import type { BaseRendererStateClosure } from '.';
import type { IBlockState } from '../../states/base';
import type { IRenderPlugin } from '../base-render-plugin';

export type IRenderPatchRender<R> = (text?: string) => R;

export interface IRenderPatchItem<R> {
  key: string;

  render: IRenderPatchRender<R>;
}

export interface BaseRendererStateClosureInputs<T, E, P, R, C = {}> {
  source: IReactiveState<IBlockState<T>[]>;

  patches: IReactiveState<IRenderPatchItem<R>[]>;

  plugins: IReactiveState<IRenderPlugin<E, P, R, C>[]>;
}

export type RendererClass<T, E, P, R, C> = Newable<
  BaseRendererStateClosure<T, E, P, R, C>,
  [BaseRendererStateClosureInputs<T, E, P, R, C>]
>;
