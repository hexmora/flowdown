import type { Root as MdastRoot } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@fluxdown/types';
import { gfmFootnoteFromMarkdown, gfmFootnoteToMarkdown } from 'mdast-util-gfm-footnote';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';

import { appendRemarkExtensions } from '../../utils';
import { BaseRemarkPlugin } from '../base';

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
