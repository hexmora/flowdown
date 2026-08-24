import type { LinkProps } from '../../../../types';

import { normalizePublicUrl } from '../../url';

export const LinkRenderer = ({ Raw, ...props }: LinkProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const {
    children,
    current: _current,
    forceHttps = true,
    href,
    onClick,
    parents: _parents,
    render: _render,
    ...elementProps
  } = props;

  const safeHref = normalizePublicUrl(href, { allowHash: true, forceHttps });

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> | undefined = onClick
    ? (event) => onClick({ event })
    : undefined;

  return (
    <a {...elementProps} href={safeHref} onClick={handleClick}>
      {children}
    </a>
  );
};
