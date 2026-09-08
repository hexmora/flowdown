/**
 * @jsxImportSource reactive
 */

import { D, type JSXDescriptor, once, useCombineMap, useSwitchMap } from 'reactive';

import type { SmoothTicksInputs } from './type';

import { type SmoothTick, TickerFrames } from './states';

export * from './type';

export const SmoothTicks = /*#__PURE__*/ once(function SmoothTicks(inputs: SmoothTicksInputs) {
  const active = useCombineMap([inputs.enabled, inputs.ticker], ([enabled, Ticker]) =>
    enabled ? Ticker : null,
  );

  return useSwitchMap(active, (Ticker): JSXDescriptor<SmoothTick> | null =>
    Ticker ? <TickerFrames Ticker={D(Ticker)} /> : null,
  );
});
