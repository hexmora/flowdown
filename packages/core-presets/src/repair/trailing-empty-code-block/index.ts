import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { Parent } from 'mdast';

import { type IPluggableConfig, PluginPriority } from '@flowdown/types';
import { last } from 'lodash-es';

import { isRepairNodeType } from '../../utils';
import { BaseRepairPlugin } from '../base';

declare global {
  interface RepairConfigs {
    'repair-trailing-empty-code-block'?: IPluggableConfig<void>;
  }
}

export class TrailingEmptyCodeBlockRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-trailing-empty-code-block';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parent, parents, insertNext }) => {
    if (!isRepairNodeType(node, 'code') || !parent || !this.isStructuralTail(node, parents)) {
      return;
    }

    if (node.value.length > 0 || (node.lang ?? '').length > 0 || (node.meta ?? '').length > 0) {
      return;
    }

    insertNext([], true);
  };

  private isStructuralTail(node: unknown, parents: Parent[]): boolean {
    let child = node;

    for (const parent of parents) {
      if (last(parent.children) !== child) {
        return false;
      }

      child = parent;
    }

    return true;
  }
}
