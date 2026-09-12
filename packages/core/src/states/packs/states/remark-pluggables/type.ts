import type { IPluggable, IRemarkPlugin, IRepairPlugin, PluginSet } from '@fluxdown/types';

import type { BlockRemarksConfig } from '../../../hast';

export type RemarkPluggablesInputs = {
  config: BlockRemarksConfig;

  extras: PluginSet<IPluggable<IRemarkPlugin, unknown>, RemarkConfigs>;

  repairs: IRepairPlugin[];
};
