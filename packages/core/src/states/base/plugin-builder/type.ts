import type { StateSource } from '@flowdown/reactive';
import type { IPluginWithConfig, PluginClass } from '@flowdown/types';

export interface PluginBuilderStateClosureParams<T extends IPluginWithConfig> {
  plugins: StateSource<PluginClass<T>[]>;

  configs: StateSource<Record<string, unknown>>;
}
