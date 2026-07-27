import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { Parent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { last, nth } from 'lodash-es';

import { isRepairNodeType } from '../utils/repair-node';
import { BaseRepairPlugin } from './base';

export class TrailingEscapeRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-trailing-escape';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parents }) => {
    if (!isRepairNodeType(node, 'text') || !this.isStructuralTail(node, parents)) {
      return;
    }

    let trailingEscapes = 0;

    for (
      let index = node.value.length - 1;
      index >= 0 && nth(node.value, index) === '\\';
      index -= 1
    ) {
      trailingEscapes += 1;
    }

    if (trailingEscapes % 2 === 1) {
      node.value = node.value.slice(0, -1);
    }
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
