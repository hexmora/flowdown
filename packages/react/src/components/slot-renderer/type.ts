import type { ComponentType } from 'react';

import type { SlotInputProps, SlotProps, SlotType } from '../../types';

export type RuntimeSlotProps = SlotProps[SlotType];

export type RuntimeSlotComponent = ComponentType<RuntimeSlotProps>;

export type RuntimeSlotInputComponent = ComponentType<SlotInputProps>;

export type NamedSlotType = Exclude<SlotType, 'Fallback' | 'Wrapper'>;

export interface SlotRendererProps {
  props: SlotInputProps;

  type: SlotType;
}

export interface SlotFallbackContextValue {
  Component: RuntimeSlotInputComponent | null;

  props: SlotInputProps;

  type: NamedSlotType;
}
