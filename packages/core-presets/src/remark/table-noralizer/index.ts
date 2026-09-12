import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import { type IBasePluginConfig, PluginPriority } from '@fluxdown/types';
import { processMdast } from '@fluxdown/utils';

import { BaseRemarkPlugin } from '../base';
import { normalizeTableColumns } from './utils';

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
