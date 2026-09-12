import {
  BaseSmoothScheduler,
  BaseSmoothTicker,
  IntervalSmoothTicker,
  RafSmoothTicker,
  Smooth,
  SpringSmoothScheduler,
} from '@fluxdown/core-presets/mapper';

import { BaseRenderer, BaseRenderPlugin } from '..';

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
      expect(typeof declaration).toBe('function');
    }
  });
});
