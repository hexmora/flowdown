import type { RepairPluginRunner, RepairPluginSystemConfig } from '@fluxdown/types';

import { PluginPriority } from '@fluxdown/types';
import { isMdastParent } from '@fluxdown/utils';

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
