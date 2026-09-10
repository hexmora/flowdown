import type { Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, type IPluggableConfig, PluginPriority } from '@flowdown/types';
import { cloneDeep } from 'lodash-es';
import rehypeRaw, { type Options } from 'rehype-raw';

import { BaseRehypePlugin } from '../base';

export type RawParserRehypePluginConfig = Options;

declare global {
  interface RehypeConfigs {
    'rehype-raw-parser'?: IPluggableConfig<RawParserRehypePluginConfig>;
  }
}

export class RawParserRehypePlugin extends BaseRehypePlugin {
  static readonly key = 'rehype-raw-parser';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Lowest,
  };

  plugin: Plugin<[], HastRoot, HastRoot>;

  private readonly innerConfig: RawParserRehypePluginConfig | undefined;

  constructor(config?: RawParserRehypePluginConfig) {
    super();

    this.innerConfig = cloneDeep(config);
    this.plugin = () => rehypeRaw(this.innerConfig);
  }
}
