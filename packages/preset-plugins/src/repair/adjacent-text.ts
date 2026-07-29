import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';
import type { RootContent, Text } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { isMdastParent } from '@flowdown/utils';

import { BaseRepairPlugin } from './base';

export class AdjacentTextRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-adjacent-text';

  readonly config: RepairPluginSystemConfig = {
    ending: false,
    priority: PluginPriority.Lowest,
  };

  runner: RepairPluginRunner = ({ node }) => {
    if (!isMdastParent(node)) {
      return;
    }

    const children: RootContent[] = [];
    let currentText: Text | undefined;
    let changed = false;

    for (const child of node.children) {
      if (child.type !== 'text') {
        children.push(child);
        currentText = undefined;
        continue;
      }

      if (child.value.length === 0) {
        changed = true;
        continue;
      }

      if (!currentText) {
        children.push(child);
        currentText = child;
        continue;
      }

      currentText.value += child.value;

      if (currentText.position && child.position) {
        currentText.position.end = child.position.end;
      }

      changed = true;
    }

    if (changed) {
      node.children.splice(0, node.children.length, ...children);
    }
  };
}
