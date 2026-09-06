import type { IPluggable, IPluginWithConfig } from '@flowdown/types';
import type { IReadableClosure } from 'reactive';

export interface PluginBuilderInputs<T extends IPluginWithConfig> {
  plugins: IReadableClosure<IPluggable<T, unknown>[]>;

  sort?: boolean;
}

export type PluginEntry<T extends IPluginWithConfig> = {
  instance: T;

  pluggable: IPluggable<T, unknown>;
};
