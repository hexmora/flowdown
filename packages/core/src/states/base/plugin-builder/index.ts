import type { IPluginWithConfig } from '@fluxdown/types';
import type { IDestructible } from 'functive';

import { cacheDiffMap } from '@fluxdown/utils';
import { once, useClearable, useMap } from 'functive';

import type { PluginBuilderInputs, PluginEntry } from './type';

import { buildPluggables, isPluggableEqual, sortPluginInstances } from './utils';

export * from './type';
export * from './utils';

export const PluginBuilder = /*#__PURE__*/ once(function PluginBuilder<
  T extends IPluginWithConfig & IDestructible,
>({ plugins, sort = true }: PluginBuilderInputs<T>) {
  let entries: PluginEntry<T>[] = [];

  useClearable(() => {
    for (const { instance } of entries) {
      instance.destroy();
    }

    entries = [];
  });

  return useMap(plugins, (currentPluggables) => {
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

    const instances = entries.map(({ instance }) => instance);

    return sort ? sortPluginInstances(instances) : instances;
  });
});
