import { memo } from 'react';

import type { SlotProviderProps } from './type';

import { SlotsContext } from '../../context';
import { useSlots } from '../../hooks';

export * from './type';

export const SlotProvider = /*#__PURE__*/ memo(function SlotProvider({
  children,
  plugins,
}: SlotProviderProps) {
  const slots = useSlots(plugins);

  return <SlotsContext.Provider value={slots}>{children}</SlotsContext.Provider>;
});
