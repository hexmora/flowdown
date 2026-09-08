import { afterEach, describe, expect, test, vi } from 'vitest';

import { getNow, IntervalSmoothTicker, RafSmoothTicker } from '..';
import { FakeSmoothTicker, mockAnimationFrames } from './utils';

afterEach(() => {
  vi.useRealTimers();

  vi.restoreAllMocks();

  vi.unstubAllGlobals();
});

describe('ticker timestamps', () => {
  test('uses performance.now when available', () => {
    const now = vi.fn(() => 42);

    vi.stubGlobal('performance', { now });

    expect(getNow()).toBe(42);

    expect(now).toHaveBeenCalledOnce();
  });

  test('uses Date.now when performance is unavailable', () => {
    vi.stubGlobal('performance', undefined);

    vi.spyOn(Date, 'now').mockReturnValue(42);

    expect(getNow()).toBe(42);
  });
});

describe('RafSmoothTicker', () => {
  test('emits frame timestamps and cancels the pending frame on stop', () => {
    const frames = mockAnimationFrames();

    const ticker = new RafSmoothTicker();

    const next = vi.fn();

    ticker.value.subscribe(next);

    expect(ticker.running).toBe(false);

    expect(ticker.start()).toEqual(expect.any(Number));

    expect(ticker.running).toBe(true);

    expect(frames.request).toHaveBeenCalledOnce();

    frames.frame(1)(10);

    expect(next).toHaveBeenCalledExactlyOnceWith(10);

    expect(frames.request).toHaveBeenCalledTimes(2);

    const pending = frames.frame(2);

    ticker.stop();

    expect(ticker.running).toBe(false);

    expect(frames.cancel).toHaveBeenCalledExactlyOnceWith(2);

    pending(20);

    expect(next).toHaveBeenCalledOnce();

    expect(frames.request).toHaveBeenCalledTimes(2);

    ticker.destroy();
  });

  test('ignores an old canceled callback after restart', () => {
    const frames = mockAnimationFrames();

    const ticker = new RafSmoothTicker();

    const next = vi.fn();

    ticker.value.subscribe(next);

    ticker.start();

    const stale = frames.frame(1);

    ticker.stop();

    ticker.start();

    stale(10);

    expect(next).not.toHaveBeenCalled();

    expect(frames.request).toHaveBeenCalledTimes(2);

    frames.frame(2)(20);

    expect(next).toHaveBeenCalledExactlyOnceWith(20);

    expect(frames.request).toHaveBeenCalledTimes(3);

    ticker.destroy();
  });

  test('does not schedule another frame when an observer stops the ticker', () => {
    const frames = mockAnimationFrames();

    const ticker = new RafSmoothTicker();

    ticker.value.subscribe(() => ticker.stop());

    ticker.start();

    frames.frame(1)(10);

    expect(ticker.running).toBe(false);

    expect(frames.request).toHaveBeenCalledOnce();

    ticker.destroy();
  });

  test('starts with the Date timestamp when performance is unavailable', () => {
    mockAnimationFrames();

    vi.stubGlobal('performance', undefined);

    vi.spyOn(Date, 'now').mockReturnValue(42);

    const ticker = new RafSmoothTicker();

    expect(ticker.start()).toBe(42);

    ticker.destroy();
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

    vi.advanceTimersByTime(60);

    expect(ticker.running).toBe(false);

    expect(next).toHaveBeenCalledTimes(2);

    expect(vi.getTimerCount()).toBe(0);

    ticker.destroy();
  });

  test('defaults to approximately sixty frames per second', () => {
    vi.useFakeTimers();

    const ticker = new IntervalSmoothTicker();

    const next = vi.fn();

    ticker.value.subscribe(next);

    ticker.start();

    vi.advanceTimersByTime(50);

    expect(next).toHaveBeenCalledTimes(3);

    ticker.destroy();
  });

  test('can restart after stop without duplicating the interval', () => {
    vi.useFakeTimers();

    const ticker = new IntervalSmoothTicker(10);

    const next = vi.fn();

    ticker.value.subscribe(next);

    ticker.start();

    vi.advanceTimersByTime(10);

    ticker.stop();

    ticker.start();

    vi.advanceTimersByTime(10);

    expect(next).toHaveBeenCalledTimes(2);

    expect(vi.getTimerCount()).toBe(1);

    ticker.destroy();
  });
});

describe.each([RafSmoothTicker, IntervalSmoothTicker])('$name lifecycle', (Ticker) => {
  test('rejects repeated starts and stops', () => {
    vi.useFakeTimers();

    mockAnimationFrames();

    const ticker = new Ticker();

    expect(() => ticker.stop()).toThrow('Cannot stop a stopping ticker');

    ticker.start();

    expect(() => ticker.start()).toThrow('Cannot start a running ticker');

    ticker.stop();

    expect(() => ticker.stop()).toThrow('Cannot stop a stopping ticker');

    ticker.destroy();
  });

  test.each([false, true])('destroy completes once when running=%s', (running) => {
    vi.useFakeTimers();

    const frames = mockAnimationFrames();

    const ticker = new Ticker();

    const complete = vi.fn();

    const subscription = ticker.value.subscribe({ complete });

    if (running) {
      ticker.start();
    }

    ticker.destroy();

    ticker.destroy();

    expect(ticker.running).toBe(false);

    expect(subscription.closed).toBe(true);

    expect(complete).toHaveBeenCalledOnce();

    expect(vi.getTimerCount()).toBe(0);

    expect(frames.cancel).toHaveBeenCalledTimes(running && Ticker === RafSmoothTicker ? 1 : 0);
  });
});

describe('FakeSmoothTicker test utility', () => {
  test('supports repeated timestamps and rejects backward or inactive ticks', () => {
    const ticker = new FakeSmoothTicker(10);

    const next = vi.fn();

    ticker.value.subscribe(next);

    expect(() => ticker.tick(11)).toThrow('Cannot tick a stopping ticker');

    expect(ticker.start()).toBe(10);

    expect(() => ticker.start()).toThrow('Cannot start a running ticker');

    ticker.tick(12);

    ticker.tick(12);

    expect(() => ticker.tick(11)).toThrow('Cannot tick previous timestamp');

    expect(next.mock.calls).toEqual([[12], [12]]);

    ticker.stop();

    expect(() => ticker.stop()).toThrow('Cannot stop a stopping ticker');

    expect(() => ticker.tick(13)).toThrow('Cannot tick a stopping ticker');

    ticker.advanceTo(20);

    expect(ticker.start()).toBe(20);

    ticker.destroy();
  });
});
