import { createElement } from 'react';

import type {
  AnySlotPlugin,
  NamedSlotType,
  RuntimeSlotComponent,
  RuntimeSlotInputComponent,
  SlotInputProps,
  SlotType,
} from '../type';

export const createSlotComposer = () => {
  const rawSlots = new WeakMap<RuntimeSlotComponent, RuntimeSlotInputComponent>();

  const composedSlots = new WeakMap<
    RuntimeSlotComponent,
    WeakMap<RuntimeSlotInputComponent, RuntimeSlotInputComponent>
  >();

  return (plugins: readonly AnySlotPlugin[]): RuntimeSlotInputComponent | null => {
    let Raw: RuntimeSlotInputComponent | null = null;

    for (const plugin of plugins) {
      const Component = plugin.Component as unknown as RuntimeSlotComponent | null;

      if (!Component) {
        continue;
      }

      const Previous: RuntimeSlotInputComponent | null = Raw;

      const compositions = composedSlots.get(Component);

      const cached: RuntimeSlotInputComponent | undefined = Previous
        ? compositions?.get(Previous)
        : rawSlots.get(Component);

      if (cached) {
        Raw = cached;

        continue;
      }

      const ComposedSlot = (props: SlotInputProps) =>
        createElement(Component, { ...props, Raw: Previous });

      ComposedSlot.displayName = `FlowdownSlot(${Component.displayName ?? (Component.name || 'Anonymous')})`;

      if (Previous) {
        const current =
          compositions ?? new WeakMap<RuntimeSlotInputComponent, RuntimeSlotInputComponent>();

        current.set(Previous, ComposedSlot);

        composedSlots.set(Component, current);
      } else {
        rawSlots.set(Component, ComposedSlot);
      }

      Raw = ComposedSlot;
    }

    return Raw;
  };
};

export const isNamedSlot = (type: SlotType): type is NamedSlotType =>
  type !== 'Fallback' && type !== 'Wrapper';
