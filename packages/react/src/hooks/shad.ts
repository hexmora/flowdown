import type { CSSProperties } from 'react';

import { PREFIX } from '@flowdown/react-presets/base';
import { isBoolean } from 'lodash-es';

import type { ShadConfig } from '../types';

export const useShadStyles = (shad: boolean | ShadConfig): CSSProperties => {
  const maskWidth = isBoolean(shad) ? 15 : (shad.maskWidth ?? 15);

  return {
    [`--${PREFIX}-shad-mask-width`]: `${Number.isFinite(maskWidth) ? Math.max(0, maskWidth) : 15}px`,
  } as CSSProperties;
};
