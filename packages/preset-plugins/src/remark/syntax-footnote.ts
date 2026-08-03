import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { gfmFootnoteFromMarkdown, gfmFootnoteToMarkdown } from 'mdast-util-gfm-footnote';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';

import type { MdastRoot } from '../typings';

import { appendRemarkExtensions } from '../utils';
import { BaseRemarkPlugin } from './base';

export class SyntaxFootnoteRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-footnote';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Highest,
  };

  plugin: Plugin<[], MdastRoot, MdastRoot> = function () {
    appendRemarkExtensions(this.data(), {
      micromark: gfmFootnote(),
      fromMarkdown: gfmFootnoteFromMarkdown(),
      toMarkdown: gfmFootnoteToMarkdown(),
    });
  };
}
