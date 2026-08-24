import type { StateSource } from '@flowdown/reactive';
import type { IPluggable, IPluginWithConfig } from '@flowdown/types';

export interface PluginBuilderStateClosureParams<T extends IPluginWithConfig> {
  plugins: StateSource<IPluggable<T, unknown>[]>;

  sort?: boolean;
}
