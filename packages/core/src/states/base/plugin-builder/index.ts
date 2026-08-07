import type { IPluggable, IPluginWithConfig } from '@flowdown/types';
import type { IDestructible } from '@flowdown/utils';

import { BaseStateClosure } from '@flowdown/reactive';
import { cacheDiffMap } from '@flowdown/utils';

import type { PluginBuilderStateClosureParams } from './type';

import {
  buildPluggables,
  isPluggableEqual,
  pluginsToPluggables,
  sortPluginInstances,
} from './utils';

export * from './type';
export * from './utils';

type PluginEntry<T extends IPluginWithConfig> = {
  instance: T;
  pluggable: IPluggable<T, unknown>;
};

export class PluginBuilderStateClosure<
  T extends IPluginWithConfig & IDestructible,
> extends BaseStateClosure<T[]> {
  constructor({ plugins, configs }: PluginBuilderStateClosureParams<T>) {
    super({
      source: () => {
        let entries: PluginEntry<T>[] = [];

        const state = this.combineMap([plugins, configs], ([currentPlugins, currentConfigs]) => {
          const currentPluggables = pluginsToPluggables(currentPlugins, currentConfigs);

          entries = cacheDiffMap({
            prev: entries.map((entry) => [entry.pluggable, entry]),
            current: currentPluggables,
            mapper: (pluggable) => ({
              instance: buildPluggables(pluggable),
              pluggable,
            }),
            comparer: isPluggableEqual,
            teardown: ({ instance }) => instance.destroy(),
          });

          return sortPluginInstances(entries.map(({ instance }) => instance));
        });

        this.clearable(() => {
          for (const { instance } of entries) {
            instance.destroy();
          }

          entries = [];
        });

        return state;
      },
    });
  }
}
