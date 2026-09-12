import type { IReactiveState } from 'functive';
import type { CSSProperties, ReactNode } from 'react';

export interface RootReconcilerProps {
  children: IReactiveState<ReactNode[]>;

  className?: string;

  style?: CSSProperties;
}
