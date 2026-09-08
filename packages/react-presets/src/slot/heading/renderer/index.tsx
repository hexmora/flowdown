import cn from 'classnames';
import { isNumber } from 'lodash-es';
import { createElement } from 'react';

import type { HeadingProps } from '../../../base';

import styles from './index.module.scss';

export const HeadingRenderer = ({ Raw: _Raw, ...props }: HeadingProps) => {
  const {
    children,
    className,
    current: _current,
    level,
    parents: _parents,
    render: _render,
    ...elementProps
  } = props;

  const safeLevel =
    isNumber(level) && Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;

  return createElement(
    `h${safeLevel}`,
    { ...elementProps, className: cn(styles.root, className) },
    children,
  );
};
