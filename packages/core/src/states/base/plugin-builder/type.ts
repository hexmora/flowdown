import type { IPluggable, IPluginWithConfig } from '@flowdown/types';

export interface PluginBuilderStateClosureInputs<T extends IPluginWithConfig> {
  plugins: IPluggable<T, unknown>[];

  sort?: boolean;
}

export type PluginEntry<T extends IPluginWithConfig> = {
  instance: T;

  pluggable: IPluggable<T, unknown>;
};
