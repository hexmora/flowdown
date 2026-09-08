import type { MapperPluggable, PluginConfigs } from '@flowdown/core';
import type { IPluggable, IPluginWithConfig } from '@flowdown/types';

import { get, has, isArray } from 'lodash-es';
import { useMemo } from 'react';

import type { IPluginItem } from '../types';

import { EL } from '../consts';

type PluginChannel = Exclude<keyof IPluginItem, 'config'>;

type PluginList<T extends PluginChannel> = NonNullable<IPluginItem[T]>;

type PackPluggable = IPluggable<IPluginWithConfig, unknown> | MapperPluggable;

const configurePluggable = (
  pluggable: PackPluggable,
  config: PluginConfigs | undefined,
): PackPluggable => {
  if (isArray(pluggable) || !('key' in pluggable) || !config || !has(config, [pluggable.key])) {
    return pluggable;
  }

  return [pluggable, get(config, [pluggable.key])];
};

export function usePlugins<T extends PluginChannel>(
  items: readonly IPluginItem[],
  type: T,
  defaults?: PluginList<T>,
): PluginList<T>;

export function usePlugins(
  items: readonly IPluginItem[],
  type: PluginChannel,
  defaults: readonly PackPluggable[] = EL,
): PackPluggable[] {
  return useMemo(
    () => [
      ...defaults,
      ...items.flatMap((item) => {
        const pluggables = item[type] ?? EL;

        return pluggables.map((pluggable) => configurePluggable(pluggable, item.config));
      }),
    ],
    [defaults, items, type],
  );
}
