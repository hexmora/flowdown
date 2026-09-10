import type { IPluggable, IPluginWithConfig, PluginClass } from '@flowdown/types';

import { isArray, isObjectLike } from 'lodash-es';

export const getPluggableClass = <T extends IPluginWithConfig>(
  pluggable: IPluggable<T, unknown>,
): PluginClass<T> => (isArray(pluggable) ? pluggable[0] : pluggable);

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
