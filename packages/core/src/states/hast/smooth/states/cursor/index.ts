import type { Subscription } from 'rxjs';

import { BaseStateClosure, ReactiveState } from '@flowdown/reactive';

import type { IScheduler, ITicker } from '../../../../../modules';
import type { SmoothSchedulerClass, SmoothTickerClass } from '../../../../packs/type';
import type { SmoothSourceSnapshot } from '../source';
import type { SmoothCursorFrame, SmoothCursorStateClosureParams } from './type';

export * from './type';

type RuntimeConfig = readonly [
  SmoothSourceSnapshot,
  boolean,
  SmoothTickerClass,
  SmoothSchedulerClass,
];

export class SmoothCursorStateClosure extends BaseStateClosure<
  SmoothCursorFrame,
  SmoothCursorStateClosureParams
> {
  protected render() {
    const { source, enabled, ticker, scheduler } = this.inputs;

    const config = this.combine(source, enabled, ticker, scheduler);

    const [initialSource] = config.value;

    let currentFrame: SmoothCursorFrame = {
      ...initialSource,
      cursor: initialSource.fullIndex,
    };

    let currentEnabled = false;

    let currentTickerClass: SmoothTickerClass | null = null;

    let currentSchedulerClass: SmoothSchedulerClass | null = null;

    let runtimeTicker: ITicker | null = null;

    let runtimeScheduler: IScheduler | null = null;

    let tickerSubscription: Subscription | null = null;

    let lastTimestamp = 0;

    const clearTicker = () => {
      tickerSubscription?.unsubscribe();

      tickerSubscription = null;

      runtimeTicker?.destroy();

      runtimeTicker = null;
    };

    const clearRuntime = () => {
      clearTicker();

      runtimeScheduler = null;

      lastTimestamp = 0;
    };

    const state = new ReactiveState<SmoothCursorFrame>({
      initial: currentFrame,
      emitter: (observer) => {
        const publishTick = (timestamp: number) => {
          if (!runtimeScheduler) {
            return;
          }

          try {
            lastTimestamp = timestamp;

            const distance = runtimeScheduler.tick(timestamp);

            if (distance <= 0) {
              return;
            }

            const cursor = Math.min(
              currentFrame.fullIndex,
              currentFrame.cursor + Math.max(0, distance),
            );

            if (cursor === currentFrame.cursor) {
              return;
            }

            currentFrame = { ...currentFrame, cursor };

            observer.next(currentFrame);
          } catch (error) {
            observer.error(error);
          }
        };

        const bindRuntime = (
          Ticker: SmoothTickerClass,
          Scheduler: SmoothSchedulerClass,
          replaceTicker: boolean,
          replaceScheduler: boolean,
        ) => {
          if (replaceTicker) {
            clearTicker();

            runtimeTicker = new Ticker();

            tickerSubscription = runtimeTicker.value.subscribe({
              next: publishTick,
              error: (error) => observer.error(error),
            });

            lastTimestamp = runtimeTicker.start();
          }

          if (replaceScheduler) {
            runtimeScheduler = new Scheduler();
          }

          if (replaceTicker || replaceScheduler) {
            runtimeScheduler?.start(lastTimestamp, currentFrame.cursor);

            runtimeScheduler?.push(currentFrame.fullIndex - currentFrame.cursor);
          }
        };

        const applyConfig = ([
          nextSource,
          nextEnabled,
          NextTicker,
          NextScheduler,
        ]: RuntimeConfig) => {
          try {
            const previousFullIndex = currentFrame.fullIndex;

            const cursor = nextEnabled
              ? Math.min(currentFrame.cursor, nextSource.fullIndex)
              : nextSource.fullIndex;

            currentFrame = { ...nextSource, cursor };

            const replaceTicker =
              runtimeTicker === null || currentTickerClass !== NextTicker || !currentEnabled;

            const replaceScheduler =
              runtimeScheduler === null ||
              currentSchedulerClass !== NextScheduler ||
              !currentEnabled;

            currentTickerClass = NextTicker;

            currentSchedulerClass = NextScheduler;

            currentEnabled = nextEnabled;

            if (!nextEnabled) {
              clearRuntime();

              observer.next(currentFrame);

              return;
            }

            bindRuntime(NextTicker, NextScheduler, replaceTicker, replaceScheduler);

            if (!replaceTicker && !replaceScheduler && runtimeScheduler) {
              if (nextSource.fullIndex < previousFullIndex) {
                runtimeScheduler.reset(cursor);

                runtimeScheduler.push(nextSource.fullIndex - cursor);
              } else if (nextSource.fullIndex > previousFullIndex) {
                runtimeScheduler.push(nextSource.fullIndex - previousFullIndex);
              }
            }

            observer.next(currentFrame);
          } catch (error) {
            observer.error(error);
          }
        };

        const subscription = config.subscribe({
          next: applyConfig,
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        });

        return () => {
          subscription.unsubscribe();

          clearRuntime();
        };
      },
    });

    return this.clearable(state);
  }
}
