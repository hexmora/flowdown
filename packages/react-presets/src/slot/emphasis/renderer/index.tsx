import cn from 'classnames';

import type { EmphasisProps } from '../../../base';

import styles from './index.module.scss';

export const EmphasisRenderer = ({ Raw: _Raw, ...props }: EmphasisProps) => {
  const {
    children,
    className,
    current: _current,
    parents: _parents,
    render: _render,
    ...elementProps
  } = props;

  return (
    <em {...elementProps} className={cn(styles.root, className)}>
      {children}
    </em>
  );
};
