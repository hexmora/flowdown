import type { ComponentType } from 'react';

import type { SlotProps, SlotType } from '../../types';

export type RuntimeSlotProps = SlotProps[SlotType];

export type RuntimeSlotComponent = ComponentType<RuntimeSlotProps>;

export type NamedSlotType = Exclude<SlotType, 'Fallback' | 'Wrapper'>;

export interface SlotRendererProps {
  props: SlotProps[SlotType];

  type: SlotType;
}

export interface SlotFallbackContextValue {
  Component: RuntimeSlotComponent | null;

  props: RuntimeSlotProps;

  type: NamedSlotType;
}
