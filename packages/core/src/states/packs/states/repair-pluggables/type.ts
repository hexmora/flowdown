import type { IPluggable, IRepairPlugin } from '@flowdown/types';

import type { BlockCompilerConfig } from '../../../hast';

export type RepairPluggablesMapperInputs = {
  config: BlockCompilerConfig;

  extras: readonly IPluggable<IRepairPlugin, unknown>[];
};
