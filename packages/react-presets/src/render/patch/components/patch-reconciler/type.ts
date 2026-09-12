import type { IRenderPatchItem } from '@fluxdown/core';
import type { IReactiveState } from 'functive';
import type { ReactNode } from 'react';

export interface PatchReconcilerProps {
  patchKey: string;

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  text?: string;
}
