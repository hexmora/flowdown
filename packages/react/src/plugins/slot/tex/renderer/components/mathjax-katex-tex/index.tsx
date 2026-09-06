import cn from 'classnames';
import { lazy, Suspense, useEffect, useMemo } from 'react';

import type { TexProps } from '../../../../../../types';

import styles from '../../index.module.scss';
import { LightTexRenderer } from '../light-tex';
import { katexTexToHtml } from './utils';

const LazyMathjaxTexRenderer = /*#__PURE__*/ lazy(() =>
  import('../mathjax-tex').catch(() => ({ default: LightTexRenderer })),
);

export const MathjaxKatexTexRenderer = (props: TexProps) => {
  const { className, mode = 'inline', style, tex } = props;
  const html = useMemo(() => katexTexToHtml(tex, mode), [mode, tex]);

  useEffect(() => {
    void import('katex/dist/katex.min.css').catch(() => {
      // Keep formulas available when the optional stylesheet cannot load.
    });
  }, []);

  if (html === null) {
    return (
      <Suspense fallback={<LightTexRenderer {...props} />}>
        <LazyMathjaxTexRenderer {...props} />
      </Suspense>
    );
  }

  const Root = mode === 'display' ? 'div' : 'span';

  return (
    <Root
      className={cn(styles.root, className)}
      dangerouslySetInnerHTML={{ __html: html }}
      data-mode={mode}
      data-tex={tex}
      style={style}
    />
  );
};

export default MathjaxKatexTexRenderer;
