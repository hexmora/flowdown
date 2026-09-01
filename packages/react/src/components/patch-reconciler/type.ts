import type { IRenderPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';
import type { IReactiveState } from 'reactive';

export interface PatchReconcilerProps {
  patchKey: string;

  patches: IReactiveState<IRenderPatchItem<ReactNode>[]>;

  text?: string;
}
