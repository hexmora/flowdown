import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { ITicker } from '..';
import type { TickerParams } from '../../../states/packs';
import type { Newable } from '../../../typings';

import { getNow, IntervalSmoothTicker, RafSmoothTicker } from '..';
import { ALL_TICKERS } from '../../../states/packs';
import { FakeSmoothTicker } from './utils';

afterEach(() => {
  vi.useRealTimers();

  vi.restoreAllMocks();

  vi.unstubAllGlobals();
});

describe('smooth ticker exports', () => {
  test('exposes only production ticker constructors', () => {
    expect(ALL_TICKERS).toEqual([RafSmoothTicker, IntervalSmoothTicker]);
    expect(RafSmoothTicker.name).toBe('raf');
    expect(IntervalSmoothTicker.name).toBe('interval');

    expectTypeOf(ALL_TICKERS).toEqualTypeOf<Newable<ITicker, TickerParams>[]>();
  });
});

describe('smooth ticker utilities', () => {
  test('uses the performance timestamp when available', () => {
    const now = vi.fn(() => 42);

    vi.stubGlobal('performance', { now });

    expect(getNow()).toBe(42);

    expect(now).toHaveBeenCalledOnce();
  });

  test('uses the current date when performance is unavailable', () => {
    vi.stubGlobal('performance', undefined);

    vi.spyOn(Date, 'now').mockReturnValue(42);

    expect(getNow()).toBe(42);
  });
});

describe('RafSmoothTicker', () => {
  test('schedules frames, emits timestamps, and cancels the pending frame', () => {
    const callbacks = new Map<number, (timestamp: number) => void>();

    let currentId = 0;

    const requestFrame = vi.fn((callback: (timestamp: number) => void) => {
      currentId += 1;

      callbacks.set(currentId, callback);

      return currentId;
    });
    const cancelFrame = vi.fn((id: number) => {
      callbacks.delete(id);
    });

    vi.stubGlobal('requestAnimationFrame', requestFrame);

    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    const ticker = new RafSmoothTicker();
    const next = vi.fn();

    ticker.value.subscribe(next);

    expect(ticker.start()).toEqual(expect.any(Number));
    expect(ticker.running).toBe(true);
    expect(requestFrame).toHaveBeenCalledOnce();

    callbacks.get(1)?.(10);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenLastCalledWith(10);
    expect(requestFrame).toHaveBeenCalledTimes(2);

    const secondTick = callbacks.get(2);

    ticker.stop();

    expect(ticker.running).toBe(false);
    expect(cancelFrame).toHaveBeenCalledWith(2);

    secondTick?.(20);

    expect(next).toHaveBeenCalledOnce();
  });

  test('ignores a canceled callback after restarting', () => {
    const callbacks = new Map<number, (timestamp: number) => void>();

    let currentId = 0;

    const requestFrame = vi.fn((callback: (timestamp: number) => void) => {
      currentId += 1;

      callbacks.set(currentId, callback);

      return currentId;
    });

    vi.stubGlobal('requestAnimationFrame', requestFrame);

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const ticker = new RafSmoothTicker();
    const next = vi.fn();

    ticker.value.subscribe(next);

    ticker.start();

    const canceledCallback = callbacks.get(1);

    ticker.stop();

    ticker.start();

    canceledCallback?.(10);

    expect(next).not.toHaveBeenCalled();
    expect(requestFrame).toHaveBeenCalledTimes(2);

    callbacks.get(2)?.(20);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenLastCalledWith(20);
    expect(requestFrame).toHaveBeenCalledTimes(3);

    ticker.stop();
  });

  test('rejects repeated starts and stops', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const ticker = new RafSmoothTicker();

    ticker.start();

    expect(() => ticker.start()).toThrowError('Cannot start a running ticker');

    ticker.stop();

    expect(() => ticker.stop()).toThrowError('Cannot stop a stopping ticker');
  });

  test('falls back to the current date when Performance is unavailable', () => {
    vi.stubGlobal('performance', undefined);

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    vi.spyOn(Date, 'now').mockReturnValue(42);

    const ticker = new RafSmoothTicker();

    expect(ticker.start()).toBe(42);

    ticker.stop();
  });

  test('destroy stops a running ticker and completes subscribers once', () => {
    const cancelFrame = vi.fn();

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );

    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    const ticker = new RafSmoothTicker();
    const complete = vi.fn();

    ticker.value.subscribe({ complete });

    ticker.start();

    ticker.destroy();
    ticker.destroy();

    expect(ticker.running).toBe(false);
    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
  });
});

describe('IntervalSmoothTicker', () => {
  test('emits on the configured interval and stops future emissions', () => {
    vi.useFakeTimers();

    const ticker = new IntervalSmoothTicker(20);
    const next = vi.fn();

    ticker.value.subscribe(next);

    expect(ticker.start()).toEqual(expect.any(Number));
    expect(ticker.running).toBe(true);

    vi.advanceTimersByTime(45);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenNthCalledWith(1, expect.any(Number));

    ticker.stop();

    expect(ticker.running).toBe(false);

    vi.advanceTimersByTime(60);

    expect(next).toHaveBeenCalledTimes(2);
  });

  test('uses an approximately 60 fps default interval', () => {
    vi.useFakeTimers();

    const ticker = new IntervalSmoothTicker();
    const next = vi.fn();

    ticker.value.subscribe(next);

    ticker.start();

    vi.advanceTimersByTime(50);

    expect(next).toHaveBeenCalledTimes(3);

    ticker.stop();
  });

  test('rejects repeated starts and stops', () => {
    vi.useFakeTimers();

    const ticker = new IntervalSmoothTicker(10);

    ticker.start();

    expect(() => ticker.start()).toThrowError('Cannot start a running ticker');

    ticker.stop();

    expect(() => ticker.stop()).toThrowError('Cannot stop a stopping ticker');
  });
});

describe('FakeSmoothTicker test utility', () => {
  test('emits only forward timestamps while running', () => {
    const ticker = new FakeSmoothTicker(10);
    const next = vi.fn();

    ticker.value.subscribe(next);

    expect(() => ticker.tick(11)).toThrowError('Cannot tick a stopping ticker');

    expect(ticker.start()).toBe(10);

    ticker.tick(12);
    ticker.tick(12);

    expect(() => ticker.tick(11)).toThrowError('Cannot tick previous timestamp');
    expect(next.mock.calls).toEqual([[12], [12]]);

    ticker.stop();

    expect(() => ticker.tick(13)).toThrowError('Cannot tick a stopping ticker');
  });
});
