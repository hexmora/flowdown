import type { PluginConfigs } from '@flowdown/core';
import type { IPluggable, IPluginWithConfig } from '@flowdown/types';

import { PluginBuilderStateClosure } from '@flowdown/core';
import { get, has, set } from 'lodash-es';
import { useMemo } from 'react';

import type { AnySlotPluggable, AnySlotPlugin, IPluginItem, Slots } from '../types';

import { EL } from '../consts';
import { isPluggablesEqual } from '../utils';
import { useDeferredUnmount, useStatic } from './base';
import { useStateOf, useStateValue } from './reactive';

type PluginChannel = Exclude<keyof IPluginItem, 'config'>;

type PluginList<T extends PluginChannel> = NonNullable<IPluginItem[T]>;

type PackPluggable = IPluggable<IPluginWithConfig, unknown>;

const configurePluggable = (
  pluggable: PackPluggable,
  config: PluginConfigs | undefined,
): PackPluggable => {
  if (Array.isArray(pluggable) || !config || !has(config, [pluggable.key])) {
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

export const useSlots = (pluggables: readonly AnySlotPluggable[]): Partial<Slots> => {
  const plugins = useStateOf<AnySlotPluggable[]>([...pluggables], isPluggablesEqual);

  const builder = useStatic(
    () =>
      new PluginBuilderStateClosure<AnySlotPlugin>({
        plugins,
        sort: false,
      }),
  );

  const instances = useStateValue(builder.value);

  useDeferredUnmount(() => builder.destroy());

  return useMemo(() => {
    const slots: Partial<Slots> = {};

    for (const instance of instances) {
      if (!instance.Component) {
        continue;
      }

      const current = slots[instance.type] ?? [];

      set(slots, [instance.type], [...current, instance]);
    }

    return slots;
  }, [instances]);
};
