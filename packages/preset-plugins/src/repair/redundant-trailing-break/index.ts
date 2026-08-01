import type { RepairPluginRunner, RepairPluginSystemConfig } from '@flowdown/types';

import { PluginPriority } from '@flowdown/types';
import { isMdastParent } from '@flowdown/utils';

import { BaseRepairPlugin } from '../base';
import { INLINE_PARENT_TYPES, removeTrailingBreaks } from './utils';

export class RedundantTrailingBreakRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-redundant-trailing-break';

  readonly config: RepairPluginSystemConfig = {
    ending: false,
    priority: PluginPriority.Lowest,
  };

  runner: RepairPluginRunner = ({ node }) => {
    if (!isMdastParent(node) || INLINE_PARENT_TYPES.includes(node.type)) {
      return;
    }

    removeTrailingBreaks(node);
  };
}
