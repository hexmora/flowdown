import type {
  IRenderPatchItem,
  IRenderPlugin,
  IRenderPluginMatchParams,
  IRenderPluginRenderParams,
} from '@fluxdown/core';
import type { IPluggable } from '@fluxdown/types';
import type { IReactiveState } from 'functive';
import type { Element, ElementContent, Parent } from 'hast';
import type { ReactNode } from 'react';

export interface ReactRenderExtraParams {
  getProps: (node?: Element) => Record<string, unknown>;

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  renderChildren: (node?: Parent) => ReactNode;
}

export type ReactRenderParams = IRenderPluginRenderParams<
  ElementContent,
  Parent,
  ReactNode,
  ReactRenderExtraParams
>;

export interface IReactRenderPlugin extends IRenderPlugin<
  ElementContent,
  Parent,
  ReactNode,
  ReactRenderExtraParams
> {}

export type IReactRenderPluggable<O = unknown> = IPluggable<IReactRenderPlugin, O>;

export type ReactRenderMatchParams = IRenderPluginMatchParams<ElementContent, Parent>;
