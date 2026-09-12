import type { IPluggable, IRehypePlugin } from '@fluxdown/types';

import type { BlockCompilerConfig } from '../../../hast';

export type RehypePluggablesMapperInputs = {
  config: BlockCompilerConfig;

  extras: readonly IPluggable<IRehypePlugin, unknown>[];
};
