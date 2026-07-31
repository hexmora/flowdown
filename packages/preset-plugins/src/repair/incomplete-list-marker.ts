import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';
import { last } from 'lodash-es';

import { BaseRepairPlugin } from './base';

export class IncompleteListMarkerRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-incomplete-list-marker';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parents }) => {
    if (node.type !== 'paragraph') {
      return;
    }

    let branch = node;

    for (const parent of parents) {
      if (last(parent.children) !== branch) {
        return;
      }

      branch = parent;
    }

    const tail = last(node.children);

    if (!tail || tail.type !== 'text') {
      return;
    }

    const value = tail.value.replace(/(?:^|(?:\r\n|\r|\n))[ \t]*(?:[-+*]|\d+[.)])$/, '');

    if (value === tail.value) {
      return;
    }

    if (value.length === 0) {
      node.children.splice(node.children.length - 1, 1);

      return;
    }

    tail.value = value;
  };
}
