import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';
import { last } from 'lodash-es';

import { isRepairNodeType } from '../utils/repair-node';
import { BaseRepairPlugin } from './base';

export class IncompleteCodeFenceRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-code-fence';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parents }) => {
    if (!isRepairNodeType(node, 'code') && !isRepairNodeType(node, 'text')) {
      return;
    }

    let branch: unknown = node;

    for (const parent of parents) {
      if (last(parent.children) !== branch) {
        return;
      }

      branch = parent;
    }

    if (isRepairNodeType(node, 'code')) {
      node.value = node.value.replace(/(?:\r\n|\r|\n)`{1,2}$/, '');

      return;
    }

    if (isRepairNodeType(node, 'text')) {
      node.value = node.value.replace(/(^|(?:\r\n|\r|\n))`{1,2}$/, '$1');
    }
  };
}
