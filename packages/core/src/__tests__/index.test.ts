import {
  BaseSmoothScheduler,
  BaseSmoothTicker,
  IntervalSmoothTicker,
  RafSmoothTicker,
  Smooth,
  SpringSmoothScheduler,
} from '@flowdown/core-presets/mapper';
import { describe, expect, test } from 'vitest';

import { ALL_SCHEDULERS, ALL_TICKERS, BaseRenderer, BaseRenderPlugin } from '..';

describe('core public exports', () => {
  test('exposes renderer modules and smooth streaming declarations', () => {
    for (const declaration of [
      BaseRenderer,
      BaseRenderPlugin,
      BaseSmoothScheduler,
      BaseSmoothTicker,
      IntervalSmoothTicker,
      RafSmoothTicker,
      Smooth,
      SpringSmoothScheduler,
    ]) {
      expect(declaration).toBeTypeOf('function');
    }

    expect(ALL_TICKERS).toEqual([RafSmoothTicker, IntervalSmoothTicker]);

    expect(ALL_SCHEDULERS).toEqual([SpringSmoothScheduler]);
  });
});
