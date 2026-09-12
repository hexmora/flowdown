import type { IBasePluginConfig } from '@fluxdown/types';
import type { ElementContent, Parent } from 'hast';
import type { ReactNode } from 'react';

import { BaseRenderPlugin } from '@fluxdown/core';

import type { IReactRenderPlugin, ReactRenderExtraParams } from './type';

export * from './type';
export * from './utils';

export abstract class BaseReactRenderPlugin
  extends BaseRenderPlugin<ElementContent, Parent, ReactNode, ReactRenderExtraParams>
  implements IReactRenderPlugin
{
  readonly config: IBasePluginConfig = {};
}
