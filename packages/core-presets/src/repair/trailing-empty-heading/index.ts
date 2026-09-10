import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { Heading, Parent } from 'mdast';

import { type IPluggableConfig, PluginPriority } from '@flowdown/types';
import { last } from 'lodash-es';

import { isRepairNodeType } from '../../utils';
import { BaseRepairPlugin } from '../base';

declare global {
  interface RepairConfigs {
    'repair-trailing-empty-heading'?: IPluggableConfig<void>;
  }
}

export class TrailingEmptyHeadingRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-trailing-empty-heading';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parent, parents, insertNext }) => {
    if (!isRepairNodeType(node, 'heading') || !parent || !this.isStructuralTail(node, parents)) {
      return;
    }

    if (node.depth !== 1 || !this.isEmpty(node)) {
      return;
    }

    insertNext([], true);
  };

  private isEmpty(heading: Heading): boolean {
    return heading.children.every(
      (child) => child.type === 'text' && child.value.trim().length === 0,
    );
  }

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
