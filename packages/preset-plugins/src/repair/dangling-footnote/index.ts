import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';

import { isRepairNodeType } from '../../utils/repair-node';
import { BaseRepairPlugin } from '../base';
import { isStructuralTail, removeCompleteReferences, removeIncompleteReference } from './utils';

export class DanglingFootnoteRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-dangling-footnote';

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Low,
  };

  runner: RepairPluginRunner = ({ node, parents, skipTree }) => {
    if (node.type === 'link' || node.type === 'linkReference') {
      skipTree();
      return;
    }

    if (!isRepairNodeType(node, 'text')) {
      return;
    }

    let value = removeCompleteReferences(node.value);

    if (isStructuralTail(node, parents)) {
      value = removeIncompleteReference(value);
    }

    if (value !== node.value) {
      node.value = value;
    }
  };
}
