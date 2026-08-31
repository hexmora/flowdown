import type { IPluggable, IPluginWithConfig, PluginClass } from '@flowdown/types';

import { isArray, isObjectLike } from 'lodash-es';

export const getPluggableClass = <T extends IPluginWithConfig>(
  pluggable: IPluggable<T, unknown>,
): PluginClass<T> => (isArray(pluggable) ? pluggable[0] : pluggable);

export const mergePluginPluggables = <T extends IPluginWithConfig>(
  presets: readonly IPluggable<T, unknown>[],
  extras: readonly IPluggable<T, unknown>[],
): IPluggable<T, unknown>[] => {
  const pluggables = [...presets];

  for (const extra of extras) {
    const Plugin = getPluggableClass(extra);

    const index = pluggables.findIndex((item) => getPluggableClass(item) === Plugin);

    if (index === -1) {
      pluggables.push(extra);

      continue;
    }

    pluggables[index] = extra;
  }

  return pluggables;
};

const isPluginConfig = (value: unknown): value is Record<string, unknown> => {
  return isObjectLike(value) && !isArray(value);
};

export const getPluggableConfig = <T extends IPluginWithConfig>(
  pluggable: IPluggable<T, unknown>,
): Record<string, unknown> => {
  if (!isArray(pluggable)) {
    return {};
  }

  const config = pluggable[1];

  return isPluginConfig(config) ? config : {};
};
