import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import {
  gfmTaskListItemFromMarkdown,
  gfmTaskListItemToMarkdown,
} from 'mdast-util-gfm-task-list-item';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';

import type { MdastRoot } from '../typings';

import { appendRemarkExtensions } from '../utils';
import { BaseRemarkPlugin } from './base';

export class SyntaxTaskListRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-task-list';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Highest,
  };

  plugin: Plugin<[], MdastRoot, MdastRoot> = function () {
    appendRemarkExtensions(this.data(), {
      micromark: gfmTaskListItem(),
      fromMarkdown: gfmTaskListItemFromMarkdown(),
      toMarkdown: gfmTaskListItemToMarkdown(),
    });
  };
}
