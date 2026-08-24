import type { AnySlotPlugin, SlotType } from '../../../types';
import type { NamedSlotType, RuntimeSlotComponent, RuntimeSlotProps } from '../type';

export const composePlugins = (plugins: readonly AnySlotPlugin[]): RuntimeSlotComponent | null => {
  let Raw: RuntimeSlotComponent | null = null;

  for (const plugin of plugins) {
    const Component = plugin.Component as unknown as RuntimeSlotComponent | null;

    if (!Component) {
      continue;
    }

    if (!Raw) {
      Raw = Component;

      continue;
    }

    const Previous = Raw;

    Raw = function ComposedSlot(props: RuntimeSlotProps) {
      return <Component {...props} Raw={Previous} />;
    };
  }

  return Raw;
};

export const isNamedSlot = (type: SlotType): type is NamedSlotType =>
  type !== 'Fallback' && type !== 'Wrapper';
