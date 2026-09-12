import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { processMdast } from '@fluxdown/mdast';
import { type IBasePluginConfig, type IPluggableConfig, PluginPriority } from '@fluxdown/types';

import { BaseRemarkPlugin } from '../base';

declare global {
  interface RemarkConfigs {
    'remark-code-meta'?: IPluggableConfig<void>;
  }
}

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
