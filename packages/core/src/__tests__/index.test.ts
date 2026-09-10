import {
  BaseSmoothScheduler,
  BaseSmoothTicker,
  IntervalSmoothTicker,
  RafSmoothTicker,
  Smooth,
  SpringSmoothScheduler,
} from '@flowdown/core-presets/mapper';
import { describe, expect, test } from 'vitest';

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
      expect(declaration).toBeTypeOf('function');
    }
  });
});
