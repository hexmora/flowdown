import type { IRenderPatchItem } from '@flowdown/core';
import type { IReactiveState } from '@flowdown/reactive';
import type { ReactNode } from 'react';

export interface PatchReconcilerProps {
  patchKey: string;

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  text?: string;
}
