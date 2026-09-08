import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { isMdastParent, processMdast } from '@flowdown/utils';
import { cloneDeep } from 'lodash-es';

import type { SyntaxHtmlAllowedRemarkPluginConfig } from './type';

import { BaseRemarkPlugin } from '../base';
import { getTagName, isEnabledTag } from './utils';

export type { SyntaxHtmlAllowedRemarkPluginConfig } from './type';

export class SyntaxHtmlAllowedRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-syntax-html-allowed';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Lowest,
  };

  private readonly innerConfig: SyntaxHtmlAllowedRemarkPluginConfig;

  plugin: Plugin<[], Root, Root>;

  constructor(config: SyntaxHtmlAllowedRemarkPluginConfig = {}) {
    super();

    this.innerConfig = cloneDeep(config);
    this.plugin = () => (tree) => {
      if (!isMdastParent(tree)) {
        return;
      }

      processMdast({
        node: tree,
        runner: ({ node, parent, index }) => {
          if (node.type !== 'html' || !parent || index === undefined) {
            return;
          }

          const tagName = getTagName(node.value);

          if (!tagName || isEnabledTag(tagName, this.innerConfig.enabledTags)) {
            return;
          }

          parent.children[index] = {
            type: 'text',
            value: node.value,
          };
        },
      });
    };
  }
}
