import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, type IPluggableConfig, PluginPriority } from '@flowdown/types';
import { processMdast } from '@flowdown/utils';

import { BaseRemarkPlugin } from '../base';
import { normalizeTableColumns } from './utils';

declare global {
  interface RemarkConfigs {
    'remark-table-noralizer'?: IPluggableConfig<void>;
  }
}

export class TableNoralizerRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-table-noralizer';

  readonly config: IBasePluginConfig = {
    priority: PluginPriority.Low,
  };

  plugin: Plugin<[], Root, Root> = () => (tree) => {
    processMdast({
      node: tree,
      runner: ({ node }) => {
        if (node.type === 'table') {
          normalizeTableColumns(node);
        }
      },
    });
  };
}
