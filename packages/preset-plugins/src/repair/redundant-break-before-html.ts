import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';
import { nth } from 'lodash-es';

import { BaseRepairPlugin } from './base';

export class RedundantBreakBeforeHtmlRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-redundant-break-before-html';

  readonly config: RepairPluginSystemConfig = {
    ending: false,
    priority: PluginPriority.Default,
  };

  runner: RepairPluginRunner = ({ node, parent, index }) => {
    if (
      node.type !== 'html' ||
      !parent ||
      index === undefined ||
      index === 0 ||
      nth(parent.children, index - 1)?.type !== 'break'
    ) {
      return;
    }

    parent.children.splice(index - 1, 1);
  };
}
