import type { IRenderPatchItem } from '@flowdown/core';
import type { IReactRenderPlugin } from '@flowdown/react-presets/base';
import type { IBlockState } from '@flowdown/types';
import type { ElementContent, Parent, Root } from 'hast';
import type { ReactNode } from 'react';
import type { IReactiveState, StateSource } from 'reactive';

export interface BlockReconcilerProps {
  block: IBlockState<Root>;

  patches: StateSource<IRenderPatchItem<ReactNode>[]>;

  plugins: StateSource<IReactRenderPlugin[]>;
}

export interface RenderNodeParams {
  node: ElementContent;

  parents: Parent[];

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  plugins: IReactRenderPlugin[];
}
