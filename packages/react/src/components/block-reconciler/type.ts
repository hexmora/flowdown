import type { IBlockState, IRenderPatchItem } from '@flowdown/core';
import type { ElementContent, Parent, Root } from 'hast';
import type { ReactNode } from 'react';
import type { IReactiveState, StateSource } from 'reactive';

import type { IReactRenderPlugin } from '../../types';

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
