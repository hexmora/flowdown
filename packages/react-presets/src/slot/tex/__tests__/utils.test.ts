import { describe, expect, test } from 'vitest';

import { texToSvg } from '../renderer/components/mathjax-tex/utils';

describe('MathJax formula isolation', () => {
  test('keeps locally defined macros inside the expression that defines them', () => {
    expect(texToSvg('\\crossflowdownmacro', 'inline')).toBeNull();
    expect(texToSvg('\\def\\crossflowdownmacro{shared}\\crossflowdownmacro', 'inline')).toContain(
      '<svg',
    );
    expect(texToSvg('\\crossflowdownmacro', 'inline')).toBeNull();
  });

  test('isolates newcommand declarations across subsequent formulas and modes', () => {
    expect(
      texToSvg('\\newcommand{\\globalflowdownmacro}{shared}\\globalflowdownmacro', 'display'),
    ).toContain('<svg');
    expect(texToSvg('\\globalflowdownmacro', 'inline')).toBeNull();
    expect(texToSvg('\\globalflowdownmacro', 'display')).toBeNull();
  });
});
