import type { IReactiveState, Newable } from '@flowdown/reactive';

import type { IBlockState } from '../../states/base/base-block';
import type { BaseRenderPlugin } from '../base-render-plugin';
import type { BaseRendererStateClosure } from './index';

export type IRenderPatchRender<R> = (text?: string) => R;

export interface IRenderPatchItem<R> {
  key: string;

  render: IRenderPatchRender<R>;
}

export interface BaseRendererStateClosureParams<T, E, P, R, C = {}> {
  source: IReactiveState<IBlockState<T>[]>;

  patches: IReactiveState<IRenderPatchItem<R>[]>;

  plugins: IReactiveState<BaseRenderPlugin<E, P, R, C>[]>;
}

export type RendererClass<T, E, P, R, C> = Newable<
  BaseRendererStateClosure<T, E, P, R, C>,
  [BaseRendererStateClosureParams<T, E, P, R, C>]
>;
