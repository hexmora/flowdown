import type { MapperPluggable } from '@flowdown/core';
import type { IPluggable, IPluginWithConfig } from '@flowdown/types';
import type { FlattenedState } from 'reactive';

import { toPluggable } from '@flowdown/core';
import { useDeferredUnmount, useStateOf, useStatic } from '@flowdown/react-presets/base';
import { forEach } from 'lodash-es';
import { useMemo } from 'react';
import { flattenClosure } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { IPluginItem, PluginConfigs } from '../types';

import { EL, EO } from '../consts';

type PluginChannel = Exclude<keyof IPluginItem, 'config'>;

type PluginList<T extends PluginChannel> = NonNullable<IPluginItem[T]>;

type PackPluggable = IPluggable<IPluginWithConfig, unknown> | MapperPluggable;

export const usePluginConfig = <T extends object>(config: T): FlattenedState<T> => {
  const source = useStateOf(config, shallowEqual);

  const fields = useStatic(() => flattenClosure(source));

  useDeferredUnmount(() => forEach(fields, (field) => field.destroy()));

  return fields;
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
      ...items.flatMap((item) =>
        toPluggable<PackPluggable, PluginConfigs>([item[type] ?? EL, item.config ?? EO]),
      ),
    ],
    [defaults, items, type],
  );
}
