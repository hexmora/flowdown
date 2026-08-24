import { createElement } from 'react';

import type { ImageProps } from '../../../../types';

import { normalizePublicUrl } from '../../url';

export const ImageRenderer = ({ Raw, ...props }: ImageProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const {
    alt = '',
    current: _current,
    forceHttps = true,
    onClick,
    parents: _parents,
    render: _render,
    src,
    ...elementProps
  } = props;

  const safeSrc = normalizePublicUrl(src, { forceHttps });

  const handleClick: React.MouseEventHandler<HTMLImageElement> | undefined = onClick
    ? (event) => onClick({ event })
    : undefined;

  return createElement('img', {
    ...elementProps,
    alt,
    onClick: handleClick,
    src: safeSrc,
  });
};
