import cn from 'classnames';
import { useMemo } from 'react';

import type { LinkProps } from '../../../../types';

import { normalizePublicUrl } from '../../url';
import styles from './index.module.scss';

export const LinkRenderer = ({ Raw: _Raw, ...props }: LinkProps) => {
  const {
    children,
    className,
    current: _current,
    href,
    onClick,
    parents: _parents,
    render: _render,
    ...elementProps
  } = props;

  const safeHref = useMemo(
    () => normalizePublicUrl(href, { allowHash: true, allowMailto: true }),
    [href],
  );

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> | undefined = onClick
    ? (event) => onClick({ event })
    : undefined;

  return (
    <a
      {...elementProps}
      className={cn(styles.root, className)}
      href={safeHref}
      onClick={handleClick}
    >
      {children}
    </a>
  );
};
