import type { IPluggable, IRemarkPlugin, IRepairPlugin } from '@fluxdown/types';

import type { BlockRemarksConfig } from '../../../hast';

export type RemarkPluggablesMapperInputs = {
  config: BlockRemarksConfig;

  extras: readonly IPluggable<IRemarkPlugin, unknown>[];

  repairs: IRepairPlugin[];
};
