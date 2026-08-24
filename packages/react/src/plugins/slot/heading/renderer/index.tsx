import { isNumber } from 'lodash-es';
import { createElement } from 'react';

import type { HeadingProps } from '../../../../types';

export const HeadingRenderer = ({ Raw, ...props }: HeadingProps) => {
  if (Raw) {
    return <Raw {...props} />;
  }

  const {
    children,
    current: _current,
    level,
    parents: _parents,
    render: _render,
    ...elementProps
  } = props;

  const safeLevel =
    isNumber(level) && Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1;

  return createElement(`h${safeLevel}`, elementProps, children);
};
