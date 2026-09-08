import cn from 'classnames';

import type { TableProps } from '../../../base';

import styles from './index.module.scss';

export const TableRenderer = ({ Raw: _Raw, ...props }: TableProps) => {
  const { children, className, ...elementProps } = props;

  return (
    <div {...elementProps} className={cn(styles.root, className)}>
      <table>{children}</table>
    </div>
  );
};
