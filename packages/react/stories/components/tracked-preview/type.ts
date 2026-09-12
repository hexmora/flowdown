import type { IPatchItem } from '@fluxdown/core';
import type { ReactNode } from 'react';

import type { FluxdownConfig } from '../../../src/types';

export interface TrackedPreviewProps {
  actions?: ReactNode;

  ariaLabel: string;

  config: FluxdownConfig;

  patches?: IPatchItem<ReactNode>[];

  text: string;
}
