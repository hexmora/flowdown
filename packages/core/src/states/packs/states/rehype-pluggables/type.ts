import type { IPluggable, IRehypePlugin, PluginSet } from '@fluxdown/types';

import type { BlockCompilerConfig } from '../../../hast';

export type RehypePluggablesInputs = {
  config: BlockCompilerConfig;

  extras: PluginSet<IPluggable<IRehypePlugin, unknown>, RehypeConfigs>;
};
