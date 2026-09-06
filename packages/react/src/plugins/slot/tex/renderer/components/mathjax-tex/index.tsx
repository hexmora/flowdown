import cn from 'classnames';
import { useMemo } from 'react';

import type { TexProps } from '../../../../../../types';

import styles from '../../index.module.scss';
import { texToSvg } from './utils';

export const MathjaxTexRenderer = ({ className, mode = 'inline', style, tex }: TexProps) => {
  const html = useMemo(() => texToSvg(tex, mode), [mode, tex]);
  const Root = mode === 'display' ? 'div' : 'span';

  return (
    <Root
      aria-label={html === null ? undefined : tex}
      className={cn(styles.root, className)}
      data-formula-error={html === null || undefined}
      data-mode={mode}
      data-tex={tex}
      role={html === null ? undefined : 'math'}
      style={style}
      {...(html === null ? { children: tex } : { dangerouslySetInnerHTML: { __html: html } })}
    />
  );
};

export default MathjaxTexRenderer;
