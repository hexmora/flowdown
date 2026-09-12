import type { RepairPluginRunner, RepairPluginSystemConfig } from '@fluxdown/types';

import { isMdastParent } from '@fluxdown/mdast';
import { type IPluggableConfig, PluginPriority } from '@fluxdown/types';

import { BaseRepairPlugin } from '../base';
import { INLINE_PARENT_TYPES, removeTrailingBreaks } from './utils';

declare global {
  interface RepairConfigs {
    'repair-redundant-trailing-break'?: IPluggableConfig<void>;
  }
}

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
