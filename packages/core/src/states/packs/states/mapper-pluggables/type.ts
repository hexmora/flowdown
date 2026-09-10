import type { PluginSet } from '@flowdown/types';

import type { MapperPluggable } from '../../../base';

export type MapperPluggablesInputs = {
  extras: PluginSet<MapperPluggable, MapperConfigs>;
};
