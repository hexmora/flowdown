import { createContext } from 'react';

import type { SlotFallbackContextValue, Slots } from './type';

export const SlotFallbackContext = /*#__PURE__*/ createContext<SlotFallbackContextValue | null>(
  null,
);

export const SlotsContext = /*#__PURE__*/ createContext<Partial<Slots> | null>(null);
