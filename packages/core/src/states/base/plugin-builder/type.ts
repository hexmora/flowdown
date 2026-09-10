import type { IPluggable, IPluginWithConfig } from '@flowdown/types';
import type { IReadableClosure } from 'reactive';

import type { MapperPluggable } from '../mapper-composer';

export type AnyPluggable = IPluggable<IPluginWithConfig, unknown> | MapperPluggable;

export type PluggableOf<T extends AnyPluggable> =
  T extends IPluggable<infer P, unknown> ? IPluggable<P, unknown> : MapperPluggable;

export interface PluginBuilderInputs<T extends IPluginWithConfig> {
  plugins: IReadableClosure<IPluggable<T, unknown>[]>;

  sort?: boolean;
}

export type PluginEntry<T extends IPluginWithConfig> = {
  instance: T;

  pluggable: IPluggable<T, unknown>;
};
