import type { IPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';

export interface PlaygroundProps {
  actions?: ReactNode;

  autoPlay?: boolean;

  initialText?: string;

  patches?: IPatchItem<ReactNode>[];
}

export interface PlaygroundSettings {
  footnote: boolean;

  repair: boolean;

  repairEnding: boolean;

  tex: boolean;
}

export type PlaygroundSetting = keyof PlaygroundSettings;
