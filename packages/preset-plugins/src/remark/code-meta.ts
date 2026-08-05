import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@flowdown/types';
import { processMdast } from '@flowdown/utils';

import { BaseRemarkPlugin } from './base';

export class CodeMetaRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-code-meta';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Lowest,
  };

  plugin: Plugin<[], Root, Root> = () => (tree) => {
    processMdast({
      node: tree,
      runner: ({ node }) => {
        if (node.type !== 'code' || typeof node.meta !== 'string' || node.meta.length === 0) {
          return;
        }

        node.data = {
          ...node.data,
          hProperties: {
            ...node.data?.hProperties,
            dataMeta: node.meta,
          },
        };
      },
    });
  };
}
