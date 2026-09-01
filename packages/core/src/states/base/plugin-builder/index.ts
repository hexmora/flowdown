import type { IPluginWithConfig } from '@flowdown/types';
import type { IDestructible } from 'reactive';

import { cacheDiffMap } from '@flowdown/utils';
import { useClearable, useMap, useRef, useStableFn } from 'reactive';

import type { PluginBuilderStateClosureInputs, PluginEntry } from './type';

import { buildPluggables, isPluggableEqual, sortPluginInstances } from './utils';

export * from './type';
export { isPluggableEqual } from './utils';

export function PluginBuilderStateClosure<T extends IPluginWithConfig & IDestructible>({
  plugins,
  sort = true,
}: PluginBuilderStateClosureInputs<T>) {
  const entries = useRef<PluginEntry<T>[]>([]);

  const cleanup = useStableFn(() => {
    for (const { instance } of entries.current) {
      instance.destroy();
    }

    entries.current = [];
  });

  const state = useMap(plugins, (currentPluggables) => {
    entries.current = cacheDiffMap({
      prev: entries.current.map((entry) => [entry.pluggable, entry]),
      current: currentPluggables,
      mapper: (pluggable) => ({
        instance: buildPluggables(pluggable),
        pluggable,
      }),
      comparer: isPluggableEqual,
      teardown: ({ instance }) => instance.destroy(),
    });

    const instances = entries.current.map(({ instance }) => instance);

    return sort ? sortPluginInstances(instances) : instances;
  });

  useClearable(cleanup);

  return state;
}
