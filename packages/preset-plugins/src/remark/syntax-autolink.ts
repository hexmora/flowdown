import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import {
  gfmAutolinkLiteralFromMarkdown,
  gfmAutolinkLiteralToMarkdown,
} from 'mdast-util-gfm-autolink-literal';
import { gfmAutolinkLiteral } from 'micromark-extension-gfm-autolink-literal';

import type { MdastRoot } from '../typings';

import { appendRemarkExtensions } from '../utils';
import { BaseRemarkPlugin } from './base';

export class SyntaxAutolinkRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-autolink';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Highest,
  };

  plugin: Plugin<[], MdastRoot, MdastRoot> = function () {
    appendRemarkExtensions(this.data(), {
      micromark: gfmAutolinkLiteral(),
      fromMarkdown: gfmAutolinkLiteralFromMarkdown(),
      toMarkdown: gfmAutolinkLiteralToMarkdown(),
    });
  };
}
