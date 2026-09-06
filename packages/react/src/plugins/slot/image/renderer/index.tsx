import cn from 'classnames';
import { createElement, useMemo } from 'react';

import type { ImageProps } from '../../../../types';

import { normalizePublicUrl } from '../../url';
import styles from './index.module.scss';

export const ImageRenderer = ({ Raw: _Raw, ...props }: ImageProps) => {
  const {
    alt = '',
    className,
    current: _current,
    onClick,
    parents: _parents,
    render: _render,
    src,
    ...elementProps
  } = props;

  const safeSrc = useMemo(() => normalizePublicUrl(src), [src]);

  const handleClick: React.MouseEventHandler<HTMLImageElement> | undefined = onClick
    ? (event) => onClick({ event })
    : undefined;

  return createElement('img', {
    ...elementProps,
    alt,
    className: cn(styles.root, className),
    onClick: handleClick,
    src: safeSrc,
  });
};
