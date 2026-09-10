import type { IPluggable, IRehypePlugin, PluginSet } from '@flowdown/types';

import type { BlockCompilerConfig } from '../../../hast';

export type RehypePluggablesInputs = {
  config: BlockCompilerConfig;

  extras: PluginSet<IPluggable<IRehypePlugin, unknown>, RehypeConfigs>;
};
