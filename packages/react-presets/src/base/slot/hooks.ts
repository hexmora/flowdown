import { isPluggablesEqual, PluginBuilder } from '@flowdown/core';
import { set } from 'lodash-es';
import { useMemo } from 'react';
import { render, S } from 'reactive';

import type { AnySlotPluggable, AnySlotPlugin, Slots } from './type';

import { useDeferredUnmount, useStateOf, useStateValue, useStatic } from '../hooks';

export const useSlots = (pluggables: readonly AnySlotPluggable[]): Partial<Slots> => {
  const plugins = useStateOf<AnySlotPluggable[]>([...pluggables], isPluggablesEqual);

  const builder = useStatic(() =>
    render(
      S([
        PluginBuilder<AnySlotPlugin>,
        {
          plugins,
        },
      ]),
    ),
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
