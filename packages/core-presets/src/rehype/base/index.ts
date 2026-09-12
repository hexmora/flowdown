/* eslint-disable @typescript-eslint/no-invalid-void-type */
import type { IBasePluginConfig, IRehypePlugin } from '@fluxdown/types';
import type { Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';

import { Destructible } from 'functive';

export abstract class BaseRehypePlugin<P = void> extends Destructible implements IRehypePlugin<P> {
  config: IBasePluginConfig = {};

  abstract plugin: Plugin<P extends void ? [] : [P], HastRoot, HastRoot>;
}
