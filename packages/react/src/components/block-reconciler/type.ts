import type { IRenderPatchItem } from '@fluxdown/core';
import type { IReactRenderPlugin } from '@fluxdown/react-presets/base';
import type { IBlockState } from '@fluxdown/types';
import type { IReactiveState, StateSource } from 'functive';
import type { ElementContent, Parent, Root } from 'hast';
import type { ReactNode } from 'react';

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
