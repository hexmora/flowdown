import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type {
  BaseSmoothConfig,
  SchedulerParams,
  SchedulerType,
  SmoothSchedulerClass,
  SmoothTickerClass,
  TickerParams,
  TickerType,
} from '../type';

import { IntervalSmoothTicker, RafSmoothTicker, SpringSmoothScheduler } from '../../../externals';
import { ALL_SCHEDULERS, ALL_TICKERS } from '../consts';
import { getSchedulerByType, getTickerByType, isEnableRAF, toBaseSmoothConfig } from '../utils';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('smooth configuration', () => {
  test('exports runtime registries and their public constructor types', () => {
    expect(ALL_TICKERS).toEqual([RafSmoothTicker, IntervalSmoothTicker]);

    expect(ALL_SCHEDULERS).toEqual([SpringSmoothScheduler]);

    expectTypeOf<TickerType>().toEqualTypeOf<'raf' | 'interval'>();

    expectTypeOf<SchedulerType>().toEqualTypeOf<'spring'>();

    expectTypeOf<TickerParams>().toEqualTypeOf<[interval?: number]>();

    expectTypeOf<SchedulerParams>().toEqualTypeOf<[tuple?: number[]]>();

    expectTypeOf<typeof RafSmoothTicker>().toMatchTypeOf<SmoothTickerClass>();

    expectTypeOf<typeof SpringSmoothScheduler>().toMatchTypeOf<SmoothSchedulerClass>();
  });

  test('resolves exact runtime names and preserves custom constructors', () => {
    expect(getTickerByType('raf')).toBe(RafSmoothTicker);

    expect(getTickerByType('interval')).toBe(IntervalSmoothTicker);

    expect(getSchedulerByType('spring')).toBe(SpringSmoothScheduler);

    class CustomTicker extends RafSmoothTicker {}

    class CustomScheduler extends SpringSmoothScheduler {}

    expect(getTickerByType(CustomTicker)).toBe(CustomTicker);

    expect(getSchedulerByType(CustomScheduler)).toBe(CustomScheduler);
  });

  test.each(['RAF', 'r', 'missing'])('rejects the ticker name %s', (name) => {
    expect(() => getTickerByType(name as TickerType)).toThrow(`Unknown ticker type: ${name}`);
  });

  test.each(['SPRING', 's', 'missing'])('rejects the scheduler name %s', (name) => {
    expect(() => getSchedulerByType(name as SchedulerType)).toThrow(
      `Unknown scheduler type: ${name}`,
    );
  });

  test.each([
    { request: true, cancel: true, ticker: RafSmoothTicker },
    { request: true, cancel: false, ticker: IntervalSmoothTicker },
    { request: false, cancel: true, ticker: IntervalSmoothTicker },
    { request: false, cancel: false, ticker: IntervalSmoothTicker },
  ])(
    'selects the default ticker with request=$request and cancel=$cancel',
    ({ request, cancel, ticker }) => {
      vi.stubGlobal('requestAnimationFrame', request ? vi.fn() : undefined);

      vi.stubGlobal('cancelAnimationFrame', cancel ? vi.fn() : undefined);

      expect(isEnableRAF()).toBe(request && cancel);

      for (const enabled of [true, false]) {
        expect(toBaseSmoothConfig(enabled)).toEqual({
          enabled,
          ticker,
          scheduler: SpringSmoothScheduler,
        });
      }
    },
  );

  test('uses an explicit configuration regardless of available RAF APIs', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const result = toBaseSmoothConfig({ enabled: true, ticker: 'interval', scheduler: 'spring' });

    expect(result).toEqual({
      enabled: true,
      ticker: IntervalSmoothTicker,
      scheduler: SpringSmoothScheduler,
    });

    expectTypeOf(result).toEqualTypeOf<BaseSmoothConfig>();

    expect(toBaseSmoothConfig({ ticker: 'raf', scheduler: 'spring' }).enabled).toBe(false);
  });
});
