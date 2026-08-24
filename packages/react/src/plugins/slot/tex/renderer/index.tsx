import { createElement } from 'react';

import type { TexProps } from '../../../../types';

export const TexRenderer = ({ Raw, ...props }: TexProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const {
    current: _current,
    mode,
    parents: _parents,
    render: _render,
    tex,
    ...elementProps
  } = props;

  return createElement(mode === 'display' ? 'div' : 'span', elementProps, tex);
};
