import type { IPluggable, IRepairPlugin, PluginSet } from '@flowdown/types';

import type { BlockCompilerConfig } from '../../../hast';

export type RepairPluggablesInputs = {
  config: BlockCompilerConfig;

  extras: PluginSet<IPluggable<IRepairPlugin, unknown>, RepairConfigs>;
};
