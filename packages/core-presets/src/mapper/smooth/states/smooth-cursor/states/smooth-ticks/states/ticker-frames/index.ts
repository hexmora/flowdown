import { once, ReactiveState, useClearable, useMap } from 'functive';
import { once as onceCallback } from 'lodash-es';

import type { SmoothTick, TickerFramesInputs } from './type';

export * from './type';

export const TickerFrames = /*#__PURE__*/ once(function TickerFrames({
  Ticker,
}: TickerFramesInputs) {
  const ticker = new Ticker();

  const handleDestroy = useClearable(onceCallback(() => ticker.destroy()));

  const timestamps = useClearable(
    new ReactiveState({
      initial: ticker.start(),

      emitter: (observer) => {
        const subscription = ticker.value.subscribe(observer);

        subscription.add(handleDestroy);

        return subscription;
      },
    }),
  );

  return useMap(timestamps, (timestamp): SmoothTick => ({ ticker, timestamp }));
});
