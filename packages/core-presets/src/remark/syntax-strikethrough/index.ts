import type { Root as MdastRoot } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, type IPluggableConfig, PluginPriority } from '@flowdown/types';
import {
  gfmStrikethroughFromMarkdown,
  gfmStrikethroughToMarkdown,
} from 'mdast-util-gfm-strikethrough';
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough';

import { appendRemarkExtensions } from '../../utils';
import { BaseRemarkPlugin } from '../base';

export interface SyntaxStrikethroughRemarkPluginConfig {
  singleTilde?: boolean | null;
}

declare global {
  interface RemarkConfigs {
    'remark-syntax-strikethrough'?: IPluggableConfig<SyntaxStrikethroughRemarkPluginConfig>;
  }
}

export class SyntaxStrikethroughRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-strikethrough';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Highest,
  };

  private readonly innerConfig: SyntaxStrikethroughRemarkPluginConfig;

  plugin: Plugin<[], MdastRoot, MdastRoot>;

  constructor(config: SyntaxStrikethroughRemarkPluginConfig = {}) {
    super();

    this.innerConfig = { ...config };
    const { innerConfig } = this;
    this.plugin = function () {
      appendRemarkExtensions(this.data(), {
        micromark: gfmStrikethrough(innerConfig),
        fromMarkdown: gfmStrikethroughFromMarkdown(),
        toMarkdown: gfmStrikethroughToMarkdown(),
      });
    };
  }
}
