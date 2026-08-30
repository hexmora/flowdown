import { describe, expect, test } from 'vitest';

import {
  ALL_SCHEDULERS,
  ALL_TICKERS,
  BaseRendererStateClosure,
  BaseRenderPlugin,
  BaseSmoothScheduler,
  BaseSmoothTicker,
  IntervalSmoothTicker,
  RafSmoothTicker,
  SmoothStateClosure,
  SpringSmoothScheduler,
} from '..';

describe('core root exports', () => {
  test('exports renderer and smooth runtime modules', () => {
    expect(BaseRenderPlugin).toBeTypeOf('function');
    expect(BaseRendererStateClosure).toBeTypeOf('function');
    expect(BaseSmoothScheduler).toBeTypeOf('function');
    expect(BaseSmoothTicker).toBeTypeOf('function');
    expect(IntervalSmoothTicker).toBeTypeOf('function');
    expect(RafSmoothTicker).toBeTypeOf('function');
    expect(SmoothStateClosure).toBeTypeOf('function');
    expect(SpringSmoothScheduler).toBeTypeOf('function');
    expect(ALL_TICKERS).toEqual([RafSmoothTicker, IntervalSmoothTicker]);
    expect(ALL_SCHEDULERS).toEqual([SpringSmoothScheduler]);
  });
});
