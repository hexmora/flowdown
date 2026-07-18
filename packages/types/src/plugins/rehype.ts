/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { IDestructible } from '@flowdown/utils';
import type { Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';

import type { IBasePluginConfig, IPluggable, IPluginWithConfig } from './base';

export interface IRehypePlugin<P = void> extends IPluginWithConfig, IDestructible {
  config: IBasePluginConfig;

  plugin: Plugin<P extends void ? [] : [P], HastRoot, HastRoot>;
}

export type IRehypePluggable<P = void> = IPluggable<IRehypePlugin<P>, P, void>;
