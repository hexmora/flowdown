import type { IPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';

import type { FlowdownConfig } from '../../../src/types';

export interface TrackedPreviewProps {
  actions?: ReactNode;

  ariaLabel: string;

  config: FlowdownConfig;

  patches?: IPatchItem<ReactNode>[];

  text: string;
}
