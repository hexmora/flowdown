import { assert } from '@fluxdown/utils';
import { expectTypeOf } from 'expect-type';
import { MutableState, ReactiveState, render, S } from 'functive';

import type { SmoothTickerClass } from '../../../../..';
import type { SmoothTick } from '../states';

import { SmoothTicks } from '..';
import {
  latest,
  PrimarySmoothTicker,
  resetSmoothTests,
  SecondarySmoothTicker,
} from '../../../../../__tests__/utils';

const setupTicks = (active = true) => {
  const enabled = MutableState.of(active);

  const lengths = MutableState.of([3]);

  const ticker = MutableState.of<SmoothTickerClass>(PrimarySmoothTicker);

  const ticks = render(S([SmoothTicks, { enabled, lengths, ticker }]));

  return { enabled, lengths, ticker, ticks };
};

beforeEach(resetSmoothTests);

describe('SmoothTicks', () => {
  test('waits for content growth and follows the active ticker timestamps', () => {
    const { lengths, ticks } = setupTicks();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    expectTypeOf(ticks.value.value).toEqualTypeOf<SmoothTick | null>();

    expect(ticks.value.value).toBeNull();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    lengths.next([4]);

    const initial = ticks.value.value;

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(initial).toEqual({ ticker, timestamp: 0 });

    ticker.tick(16);

    expect(ticks.value.value).toEqual({ ticker, timestamp: 16 });

    ticks.destroy();

    expect(ticker.destroyCalls).toBe(1);

    expect(ticker.running).toBe(false);
  });

  test('replaces owned tickers and releases previous instances', () => {
    const { lengths, ticks, ticker } = setupTicks();

    const output = ticks.value;

    lengths.next([4]);

    const previous = latest(PrimarySmoothTicker.instances);

    ticker.next(PrimarySmoothTicker);

    expect(PrimarySmoothTicker.instances).toHaveLength(1);

    ticker.next(SecondarySmoothTicker);

    const current = latest(SecondarySmoothTicker.instances);

    expect(previous.destroyCalls).toBe(1);

    expect(previous.running).toBe(false);

    expect(output.value).toEqual({ ticker: current, timestamp: 0 });

    expect(() => previous.tick(16)).toThrow('Cannot tick a stopping ticker');

    expect(output.value).toEqual({ ticker: current, timestamp: 0 });

    current.tick(32);

    expect(output.value).toEqual({ ticker: current, timestamp: 32 });

    ticks.destroy();

    expect(current.destroyCalls).toBe(1);

    expect(ticker.closed).toBe(false);
  });

  test('ignores equal or shrinking totals and starts when a shortened stream grows again', () => {
    const { lengths, ticks } = setupTicks();

    expect(ticks.value.value).toBeNull();

    lengths.next([1, 2]);

    lengths.next([1]);

    expect(ticks.value.value).toBeNull();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    lengths.next([2]);

    expect(latest(PrimarySmoothTicker.instances).running).toBe(true);

    lengths.next([1]);

    lengths.next([3]);

    expect(PrimarySmoothTicker.instances).toHaveLength(1);

    ticks.destroy();
  });

  test('creates no disabled ticker and releases active work when disabled again', () => {
    const { enabled, lengths, ticks } = setupTicks(false);

    expect(ticks.value.value).toBeNull();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    enabled.next(true);

    expect(ticks.value.value).toBeNull();

    lengths.next([4]);

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(ticks.value.value).toEqual({ ticker, timestamp: 0 });

    enabled.next(false);

    expect(ticks.value.value).toBeNull();

    expect(ticker.destroyCalls).toBe(1);

    enabled.next(true);

    expect(ticks.value.value).toBeNull();

    lengths.next([5]);

    expect(PrimarySmoothTicker.instances).toHaveLength(2);

    ticks.destroy();

    expect(PrimarySmoothTicker.instances.every((item) => item.destroyCalls === 1)).toBe(true);

    expect(enabled.closed).toBe(false);
  });

  test('waits for new enabled growth after content changes while disabled', () => {
    const { enabled, lengths, ticks } = setupTicks(false);

    expect(ticks.value.value).toBeNull();

    lengths.next([4]);

    enabled.next(true);

    expect(ticks.value.value).toBeNull();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    lengths.next([5]);

    expect(latest(PrimarySmoothTicker.instances).running).toBe(true);

    ticks.destroy();
  });

  test('keeps the selected ticker alive after its configuration completes', () => {
    const lengths = MutableState.of([3]);

    const ticks = render(
      S([
        SmoothTicks,
        {
          enabled: ReactiveState.of(true),
          lengths,
          ticker: ReactiveState.of(PrimarySmoothTicker),
        },
      ]),
    );

    const complete = jest.fn();

    ticks.value.subscribe({ complete });

    lengths.next([4]);

    lengths.complete();

    const ticker = latest(PrimarySmoothTicker.instances);

    ticker.tick(16);

    expect(ticks.value.value).toEqual({ ticker, timestamp: 16 });

    expect(complete).not.toHaveBeenCalled();

    ticks.destroy();

    expect(complete).toHaveBeenCalledTimes(1);

    expect(ticker.destroyCalls).toBe(1);
  });

  test('releases a ticker that finishes its own timestamp stream', () => {
    class FinishingTicker extends PrimarySmoothTicker {
      finish() {
        this.subject.complete();
      }
    }

    const { lengths, ticks, ticker } = setupTicks();

    ticker.next(FinishingTicker);

    const output = ticks.value;

    lengths.next([4]);

    const current = latest(PrimarySmoothTicker.instances);

    assert(current instanceof FinishingTicker);

    current.tick(16);

    current.finish();

    expect(output.value).toEqual({ ticker: current, timestamp: 16 });

    expect(output.closed).toBe(false);

    expect(current.running).toBe(false);

    expect(current.destroyCalls).toBe(1);

    ticker.next(PrimarySmoothTicker);

    expect(latest(PrimarySmoothTicker.instances).running).toBe(true);

    ticks.destroy();

    expect(current.destroyCalls).toBe(1);
  });
});
