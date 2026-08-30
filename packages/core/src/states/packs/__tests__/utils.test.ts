import type { IRawPatchItem } from '@flowdown/types';

import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IRenderPatchItem } from '../../../modules/base-renderer';

import {
  ALL_SCHEDULERS,
  ALL_TICKERS,
  type BaseSmoothConfig,
  getSchedulerByType,
  getTickerByType,
  type IPatchItem,
  isKeyablesEqual,
  type SchedulerParams,
  type SchedulerType,
  type SmoothSchedulerClass,
  type SmoothTickerClass,
  splitPatches,
  type TickerParams,
  type TickerType,
  toBaseSmoothConfig,
  toRawPatches,
  toRenderPatches,
} from '..';
import { IntervalSmoothTicker, RafSmoothTicker, SpringSmoothScheduler } from '../../../modules';

const renderPatch = () => 'rendered';

const renderFirst = () => 'first';

const renderSecond = () => 'second';

describe('patch utilities', () => {
  test('splits raw and render fields while preserving render functions', () => {
    const render = vi.fn(() => 'rendered');
    const patches: IPatchItem<string>[] = [
      { key: 'named', range: [1, 3], render },
      { range: 4, render },
    ];

    const { rawPatches, renderPatches } = splitPatches(patches);

    expect(rawPatches).toEqual([
      { key: 'named', range: [1, 3] },
      { key: '0', range: 4 },
    ]);
    expect(renderPatches).toEqual([
      { key: 'named', render },
      { key: '0', render },
    ]);
    expect(toRawPatches(patches)).toEqual(rawPatches);
    expect(toRenderPatches(patches)).toEqual(renderPatches);
    expectTypeOf(rawPatches).toEqualTypeOf<IRawPatchItem[]>();
    expectTypeOf(renderPatches).toEqualTypeOf<IRenderPatchItem<string>[]>();
  });

  test('indexes only keyless patches so keyed insertions keep fallback keys stable', () => {
    const keyless: IPatchItem<string>[] = [
      { range: 1, render: renderPatch },
      { range: 2, render: renderPatch },
    ];
    const withKeyedInsertion: IPatchItem<string>[] = [
      keyless[0]!,
      { key: 'named', range: 3, render: renderPatch },
      keyless[1]!,
    ];

    const original = splitPatches(keyless);
    const inserted = splitPatches(withKeyedInsertion);

    expect(original.rawPatches.map(({ key }) => key)).toEqual(['0', '1']);
    expect(original.renderPatches.map(({ key }) => key)).toEqual(['0', '1']);
    expect(inserted.rawPatches.map(({ key }) => key)).toEqual(['0', 'named', '1']);
    expect(inserted.renderPatches.map(({ key }) => key)).toEqual(['0', 'named', '1']);
  });

  test('prefixes fallback keys until they do not conflict', () => {
    const { rawPatches, renderPatches } = splitPatches<string>([
      { range: 1, render: renderPatch },
      { key: '0', range: 2, render: renderPatch },
      { key: '_0', range: 3, render: renderPatch },
      { key: '__0', range: 4, render: renderPatch },
    ]);

    expect(rawPatches[0]?.key).toBe('___0');
    expect(renderPatches[0]?.key).toBe('___0');
    expect(isKeyablesEqual(rawPatches, [...rawPatches.slice(1), rawPatches[0]!])).toBe(false);
    expect(isKeyablesEqual(rawPatches, rawPatches.slice(1))).toBe(false);
  });

  test('compares keyed patch values as well as their ordered keys', () => {
    const patches: IPatchItem<string>[] = [{ key: 'stable', range: [1, 2], render: renderFirst }];

    expect(isKeyablesEqual(toRawPatches(patches), toRawPatches([...patches]))).toBe(true);
    expect(
      isKeyablesEqual(
        toRawPatches(patches),
        toRawPatches([{ key: 'stable', range: [2, 3], render: renderFirst }]),
      ),
    ).toBe(false);
    expect(
      isKeyablesEqual(
        toRenderPatches(patches),
        toRenderPatches([{ key: 'stable', range: [1, 2], render: renderSecond }]),
      ),
    ).toBe(false);
  });

  test('short-circuits identical keyed collections before reading their values', () => {
    const items = new Proxy([{ key: 'stable' }], {
      get: () => {
        throw new Error('Collection values must not be read.');
      },
    });

    expect(isKeyablesEqual(items, items)).toBe(true);
  });
});

describe('smooth constructor utilities', () => {
  test('exports smooth runtime types from packs', () => {
    expectTypeOf<SchedulerType>().toEqualTypeOf<'spring'>();

    expectTypeOf<TickerType>().toEqualTypeOf<'raf' | 'interval'>();

    expectTypeOf<SchedulerParams>().toEqualTypeOf<[tuple?: number[]]>();

    expectTypeOf<TickerParams>().toEqualTypeOf<[interval?: number]>();

    expectTypeOf<typeof SpringSmoothScheduler>().toMatchTypeOf<SmoothSchedulerClass>();

    expectTypeOf<typeof RafSmoothTicker>().toMatchTypeOf<SmoothTickerClass>();
  });

  test('exposes smooth runtime registries from packs', () => {
    expect(ALL_TICKERS).toEqual([RafSmoothTicker, IntervalSmoothTicker]);

    expect(ALL_SCHEDULERS).toEqual([SpringSmoothScheduler]);
  });

  test('resolves ticker and scheduler types by exact static class name', () => {
    expect(getTickerByType('raf')).toBe(RafSmoothTicker);

    expect(getTickerByType('interval')).toBe(IntervalSmoothTicker);

    expect(getSchedulerByType('spring')).toBe(SpringSmoothScheduler);
  });

  test('rejects differently cased and partial runtime type strings', () => {
    expect(() => getTickerByType('RAF' as 'raf')).toThrowError('Unknown ticker type: RAF');

    expect(() => getTickerByType('r' as 'raf')).toThrowError('Unknown ticker type: r');

    expect(() => getSchedulerByType('SPRING' as 'spring')).toThrowError(
      'Unknown scheduler type: SPRING',
    );

    expect(() => getSchedulerByType('s' as 'spring')).toThrowError('Unknown scheduler type: s');
  });

  test('passes custom constructors through unchanged', () => {
    expect(getTickerByType(RafSmoothTicker)).toBe(RafSmoothTicker);

    expect(getSchedulerByType(SpringSmoothScheduler)).toBe(SpringSmoothScheduler);
  });

  test('converts explicit smooth configuration to its base representation', () => {
    const configured = toBaseSmoothConfig({
      enabled: true,
      scheduler: 'spring',
      ticker: 'raf',
    });

    expect(configured).toEqual({
      enabled: true,
      scheduler: SpringSmoothScheduler,
      ticker: RafSmoothTicker,
    });

    expectTypeOf(configured).toEqualTypeOf<BaseSmoothConfig>();
  });

  test('uses RAF as the default ticker when its APIs are available', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    try {
      expect(toBaseSmoothConfig(true)).toEqual({
        enabled: true,
        scheduler: SpringSmoothScheduler,
        ticker: RafSmoothTicker,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('keeps an explicit interval ticker when the RAF APIs are available', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    try {
      expect(
        toBaseSmoothConfig({
          enabled: true,
          scheduler: 'spring',
          ticker: 'interval',
        }),
      ).toEqual({
        enabled: true,
        scheduler: SpringSmoothScheduler,
        ticker: IntervalSmoothTicker,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('uses interval as the default ticker when the RAF APIs are incomplete', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());

    vi.stubGlobal('cancelAnimationFrame', undefined);

    try {
      expect(toBaseSmoothConfig(false)).toEqual({
        enabled: false,
        scheduler: SpringSmoothScheduler,
        ticker: IntervalSmoothTicker,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('uses interval as the default ticker when requestAnimationFrame is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    try {
      expect(toBaseSmoothConfig(true)).toEqual({
        enabled: true,
        scheduler: SpringSmoothScheduler,
        ticker: IntervalSmoothTicker,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('rejects unknown runtime type strings', () => {
    expect(() => getTickerByType('missing' as 'raf')).toThrowError();
    expect(() => getSchedulerByType('missing' as 'spring')).toThrowError();
  });
});
