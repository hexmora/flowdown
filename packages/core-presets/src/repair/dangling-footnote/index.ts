import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { type IPluggableConfig, PluginPriority } from '@flowdown/types';

import { isRepairNodeType } from '../../utils';
import { BaseRepairPlugin } from '../base';
import { isStructuralTail, removeCompleteReferences, removeIncompleteReference } from './utils';

declare global {
  interface RepairConfigs {
    'repair-dangling-footnote'?: IPluggableConfig<void>;
  }
}

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
