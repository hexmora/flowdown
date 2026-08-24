import type { IBlockState, IRenderPatchItem } from '@flowdown/core';
import type { IReactiveState } from '@flowdown/reactive';
import type { ElementContent, Parent, Root } from 'hast';
import type { ReactNode } from 'react';

import type { IReactRenderPlugin } from '../../types';

export interface BlockReconcilerProps {
  block: IBlockState<Root>;

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  plugins: IReactiveState<IReactRenderPlugin[]>;
}

export interface RenderNodeParams {
  node: ElementContent;

  parents: Parent[];

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  plugins: IReactRenderPlugin[];
}
