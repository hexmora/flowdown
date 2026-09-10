import type { IPluggable, PluginSet } from '@flowdown/types';

import type { IRenderPlugin } from '../../../../externals';

export type RenderPluggablesInputs<E, P, R, C = {}> = {
  extras: PluginSet<IPluggable<IRenderPlugin<E, P, R, C>, unknown>, RenderConfigs>;
};
