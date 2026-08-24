import { createContext } from 'react';

import type { Slots } from '../../types';
import type { SlotFallbackContextValue } from './type';

export const SlotFallbackContext = /*#__PURE__*/ createContext<SlotFallbackContextValue | null>(
  null,
);

export const SlotsContext = /*#__PURE__*/ createContext<Partial<Slots> | null>(null);
