import type { IBlockState } from '@flowdown/types';
import type { IReadableClosure, Newable } from 'reactive';

import type { BaseRenderer } from '.';
import type { IRenderPlugin } from '../base-render-plugin';

export type IRenderPatchRender<R> = (text?: string) => R;

export interface IRenderPatchItem<R> {
  key: string;

  render: IRenderPatchRender<R>;
}

export interface BaseRendererInputs<T, E, P, R, C = {}> {
  source: IReadableClosure<IBlockState<T>[]>;

  patches: IReadableClosure<IRenderPatchItem<R>[]>;

  plugins: IReadableClosure<IRenderPlugin<E, P, R, C>[]>;
}

export type RendererClass<T, E, P, R, C> = Newable<
  BaseRenderer<T, E, P, R, C>,
  [BaseRendererInputs<T, E, P, R, C>]
>;
