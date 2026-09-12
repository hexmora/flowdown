import type { PluginSet } from '@fluxdown/types';

import type { MapperPluggable } from '../../../base';

export type MapperPluggablesInputs = {
  extras: PluginSet<MapperPluggable, MapperConfigs>;
};
