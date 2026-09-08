import cn from 'classnames';

import type { BreakLineProps } from '../../../base';

import styles from './index.module.scss';

export const BreakLineRenderer = ({ Raw: _Raw, ...props }: BreakLineProps) => {
  const { className, ...elementProps } = props;

  return <br {...elementProps} className={cn(styles.root, className)} />;
};
