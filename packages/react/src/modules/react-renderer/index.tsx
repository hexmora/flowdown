import type { IBlockState } from '@flowdown/core';
import type { ElementContent, Parent, Root } from 'hast';
import type { ReactNode } from 'react';

import { BaseRendererStateClosure } from '@flowdown/core';

import type { ReactRenderExtraParams } from '../../types';

import { BlockReconciler } from '../../components/block-reconciler';

export class ReactRenderer extends BaseRendererStateClosure<
  Root,
  ElementContent,
  Parent,
  ReactNode,
  ReactRenderExtraParams
> {
  protected renderItem(item: IBlockState<Root>): ReactNode {
    const { patches, plugins } = this.inputs;

    return (
      <BlockReconciler key={item.meta.value.key} block={item} patches={patches} plugins={plugins} />
    );
  }
}
