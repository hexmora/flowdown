import type { PropsWithChildren } from 'react';

import type { AnySlotPluggable } from '../../types';

export interface SlotProviderProps extends PropsWithChildren {
  plugins: readonly AnySlotPluggable[];
}
