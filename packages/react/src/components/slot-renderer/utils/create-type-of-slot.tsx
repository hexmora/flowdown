import type { ComponentType } from 'react';

import type { SlotProps, SlotType } from '../../../types';

import { SlotRenderer } from '..';

export const createTypeOfSlot = <T extends SlotType>(type: T): ComponentType<SlotProps[T]> => {
  const TypeOfSlot = (props: SlotProps[T]) => <SlotRenderer props={props} type={type} />;

  TypeOfSlot.displayName = `FlowdownTypeOfSlot(${type})`;

  return TypeOfSlot;
};
