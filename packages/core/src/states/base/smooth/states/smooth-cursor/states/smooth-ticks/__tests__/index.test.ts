import { assert } from '@flowdown/utils';
import { MutableState, ReactiveState, render, S } from 'reactive';
import { beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { SmoothTickerClass } from '../../../../../../../packs';
import type { SmoothTick } from '../index';

import {
  latest,
  PrimarySmoothTicker,
  resetSmoothTests,
  SecondarySmoothTicker,
} from '../../../../../__tests__/utils';
import { SmoothTicks } from '../index';

const setupTicks = (active = true) => {
  const enabled = MutableState.of(active);

  const ticker = MutableState.of<SmoothTickerClass>(PrimarySmoothTicker);

  const ticks = render(S([SmoothTicks, { enabled, ticker }]));

  return { enabled, ticker, ticks };
};

beforeEach(resetSmoothTests);

describe('SmoothTicks', () => {
  test('starts lazily and follows the active ticker timestamps', () => {
    const { ticks } = setupTicks();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    expectTypeOf(ticks.value.value).toEqualTypeOf<SmoothTick | null>();

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
    const { ticks, ticker } = setupTicks();

    const output = ticks.value;

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

  test('creates no disabled ticker and releases active work when disabled again', () => {
    const { enabled, ticks } = setupTicks(false);

    expect(ticks.value.value).toBeNull();

    expect(PrimarySmoothTicker.instances).toEqual([]);

    enabled.next(true);

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(ticks.value.value).toEqual({ ticker, timestamp: 0 });

    enabled.next(false);

    expect(ticks.value.value).toBeNull();

    expect(ticker.destroyCalls).toBe(1);

    enabled.next(true);

    expect(PrimarySmoothTicker.instances).toHaveLength(2);

    ticks.destroy();

    expect(PrimarySmoothTicker.instances.every((item) => item.destroyCalls === 1)).toBe(true);

    expect(enabled.closed).toBe(false);
  });

  test('keeps the selected ticker alive after its configuration completes', () => {
    const ticks = render(
      S([
        SmoothTicks,
        {
          enabled: ReactiveState.of(true),
          ticker: ReactiveState.of(PrimarySmoothTicker),
        },
      ]),
    );

    const complete = vi.fn();

    ticks.value.subscribe({ complete });

    const ticker = latest(PrimarySmoothTicker.instances);

    ticker.tick(16);

    expect(ticks.value.value).toEqual({ ticker, timestamp: 16 });

    expect(complete).not.toHaveBeenCalled();

    ticks.destroy();

    expect(complete).toHaveBeenCalledOnce();

    expect(ticker.destroyCalls).toBe(1);
  });

  test('releases a ticker that finishes its own timestamp stream', () => {
    class FinishingTicker extends PrimarySmoothTicker {
      finish() {
        this.subject.complete();
      }
    }

    const { ticks, ticker } = setupTicks();

    ticker.next(FinishingTicker);

    const output = ticks.value;

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
