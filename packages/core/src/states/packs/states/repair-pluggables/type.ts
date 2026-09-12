import type { IPluggable, IRepairPlugin, PluginSet } from '@fluxdown/types';

import type { BlockCompilerConfig } from '../../../hast';

export type RepairPluggablesInputs = {
  config: BlockCompilerConfig;

  extras: PluginSet<IPluggable<IRepairPlugin, unknown>, RepairConfigs>;
};
