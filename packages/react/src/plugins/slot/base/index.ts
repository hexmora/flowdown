import type { ISlotPlugin, SlotPositionType, SlotProps, SlotType } from '../../../types';

export abstract class BaseSlotPlugin<T extends SlotType> implements ISlotPlugin<T> {
  readonly config = {};

  abstract readonly Component: SlotPositionType<SlotProps[T]>;

  abstract readonly type: T;

  destroy() {}
}
