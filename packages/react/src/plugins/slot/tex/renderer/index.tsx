import { lazy, Suspense } from 'react';

import type { TexProps } from '../../../../types';

import { LightTexRenderer } from './components/light-tex';

const LazyMathjaxKatexTexRenderer = /*#__PURE__*/ lazy(async () => {
  try {
    const Component = await import('./components/mathjax-katex-tex');

    return Component;
  } catch {
    return { default: LightTexRenderer };
  }
});

export const TexRenderer = (props: TexProps) => {
  return (
    <Suspense fallback={<LightTexRenderer {...props} />}>
      <LazyMathjaxKatexTexRenderer {...props} />
    </Suspense>
  );
};
