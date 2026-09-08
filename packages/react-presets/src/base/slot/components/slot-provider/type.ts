import type { PropsWithChildren } from 'react';

import type { AnySlotPluggable } from '../../type';

export interface SlotProviderProps extends PropsWithChildren {
  plugins: readonly AnySlotPluggable[];
}
