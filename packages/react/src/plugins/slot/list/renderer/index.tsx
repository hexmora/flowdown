import { createElement } from 'react';

import type { ListProps } from '../../../../types';

export const ListRenderer = ({ Raw, ...props }: ListProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const {
    children,
    current: _current,
    parents: _parents,
    render: _render,
    type,
    ...elementProps
  } = props;

  return createElement(type === 'ordered' ? 'ol' : 'ul', elementProps, children);
};
