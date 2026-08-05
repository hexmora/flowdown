import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { cloneDeep } from 'lodash-es';
import rehypeRaw, { type Options } from 'rehype-raw';

import type { HastRoot } from '../typings';

import { BaseRehypePlugin } from './base';

export type RawParserRehypePluginConfig = Options;

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
