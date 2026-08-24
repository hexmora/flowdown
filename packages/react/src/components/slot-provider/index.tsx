import { memo } from 'react';

import type { SlotProviderProps } from './type';

import { useSlots } from '../../hooks';
import { SlotsContext } from '../slot-renderer/context';

export const SlotProvider = /*#__PURE__*/ memo(function SlotProvider({
  children,
  plugins,
}: SlotProviderProps) {
  const slots = useSlots(plugins);

  return <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>;
});
