import type { IRenderPatchItem, IRenderPlugin, IRenderPluginRenderParams } from '@flowdown/core';
import type { IPluggable } from '@flowdown/types';
import type { Element, ElementContent, Parent } from 'hast';
import type { ReactNode } from 'react';
import type { IReactiveState } from 'reactive';

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
