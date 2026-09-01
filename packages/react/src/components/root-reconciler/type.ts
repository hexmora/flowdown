import type { CSSProperties, ReactNode } from 'react';
import type { IReactiveState } from 'reactive';

export interface RootReconcilerProps {
  children: IReactiveState<ReactNode[]>;

  className?: string;

  style?: CSSProperties;
}
