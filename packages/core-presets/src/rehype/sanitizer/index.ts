import type { Root as HastRoot } from 'hast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@fluxdown/types';
import { cloneDeep } from 'lodash-es';
import rehypeSanitize from 'rehype-sanitize';

import type { SanitizerRehypePluginConfig } from './type';

import { BaseRehypePlugin } from '../base';
import { createSchema } from './utils';

export type { SanitizerRehypePluginConfig } from './type';

export class SanitizerRehypePlugin extends BaseRehypePlugin {
  static readonly key = 'rehype-sanitizer';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Lowest,
  };

  plugin: Plugin<[], HastRoot, HastRoot>;

  private readonly innerConfig: SanitizerRehypePluginConfig;

  constructor(config: SanitizerRehypePluginConfig = {}) {
    super();

    this.innerConfig = cloneDeep(config);
    this.plugin = () => {
      const schema = createSchema(this.innerConfig);

      return rehypeSanitize(schema);
    };
  }
}
