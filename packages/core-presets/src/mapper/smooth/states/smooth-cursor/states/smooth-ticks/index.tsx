/**
 * @jsxImportSource reactive
 */

import { sum } from 'lodash-es';
import { D, type JSXDescriptor, once, useCombineMap, useSwitchMap } from 'reactive';

import type { SmoothTickerClass } from '../../../../type';
import type { SmoothTicksInputs } from './type';

import { type SmoothTick, TickerFrames } from './states';

export * from './type';

export const SmoothTicks = /*#__PURE__*/ once(function SmoothTicks({
  enabled: _enabled,
  ticker: _ticker,
  lengths: _lengths,
}: SmoothTicksInputs) {
  const active = useCombineMap(
    [_enabled, _ticker, _lengths],
    ([enabled, Ticker, lengths], previous): SmoothTickerClass | null => {
      if (!previous) {
        return null;
      }

      const [[, , prevLengths], prevTicker] = previous;

      return enabled && (prevTicker || sum(lengths) > sum(prevLengths)) ? Ticker : null;
    },
  );

  return useSwitchMap(active, (Ticker): JSXDescriptor<SmoothTick> | null =>
    Ticker ? <TickerFrames Ticker={D(Ticker)} /> : null,
  );
});
