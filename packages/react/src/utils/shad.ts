import type { BaseShadConfig } from '@flowdown/core-presets/mapper';

import { isBoolean, isFinite } from 'lodash-es';

import type { ShadConfig } from '../types';

export const toShadConfig = (config: boolean | ShadConfig): BaseShadConfig => {
  const { enabled = true, length = 2 } = isBoolean(config) ? { enabled: config } : config;

  return {
    enabled,
    length: isFinite(length) ? Math.max(0, Math.floor(length)) : 0,
  };
};
