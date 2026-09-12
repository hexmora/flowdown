/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { IDestructible } from 'functive';
import type { Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';

import type { IBasePluginConfig, IPluginWithConfig } from './base';

export interface IRehypePlugin<P = void> extends IPluginWithConfig, IDestructible {
  config: IBasePluginConfig;

  plugin: Plugin<P extends void ? [] : [P], HastRoot, HastRoot>;
}
