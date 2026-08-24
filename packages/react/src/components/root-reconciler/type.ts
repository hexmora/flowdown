import type { IReactiveState } from '@flowdown/reactive';
import type { CSSProperties, ReactNode } from 'react';

export interface RootReconcilerProps {
  children: IReactiveState<ReactNode[]>;

  className?: string;

  style?: CSSProperties;
}
