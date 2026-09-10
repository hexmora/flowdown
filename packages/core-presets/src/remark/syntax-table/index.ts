import type { Root as MdastRoot } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, type IPluggableConfig, PluginPriority } from '@flowdown/types';
import { gfmTableFromMarkdown, gfmTableToMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';

import { appendRemarkExtensions } from '../../utils';
import { BaseRemarkPlugin } from '../base';

declare global {
  interface RemarkConfigs {
    'remark-syntax-table'?: IPluggableConfig<void>;
  }
}

export class SyntaxTableRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-table';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Highest,
  };

  plugin: Plugin<[], MdastRoot, MdastRoot> = function () {
    appendRemarkExtensions(this.data(), {
      micromark: gfmTable(),
      fromMarkdown: gfmTableFromMarkdown(),
      toMarkdown: gfmTableToMarkdown(),
    });
  };
}
