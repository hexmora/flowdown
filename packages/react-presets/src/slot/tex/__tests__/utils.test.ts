import { texToSvg } from '../renderer/components/mathjax-tex/utils';

describe('MathJax formula isolation', () => {
  test('keeps locally defined macros inside the expression that defines them', () => {
    expect(texToSvg('\\crossfluxdownmacro', 'inline')).toBeNull();
    expect(texToSvg('\\def\\crossfluxdownmacro{shared}\\crossfluxdownmacro', 'inline')).toContain(
      '<svg',
    );
    expect(texToSvg('\\crossfluxdownmacro', 'inline')).toBeNull();
  });

  test('isolates newcommand declarations across subsequent formulas and modes', () => {
    expect(
      texToSvg('\\newcommand{\\globalfluxdownmacro}{shared}\\globalfluxdownmacro', 'display'),
    ).toContain('<svg');
    expect(texToSvg('\\globalfluxdownmacro', 'inline')).toBeNull();
    expect(texToSvg('\\globalfluxdownmacro', 'display')).toBeNull();
  });
});
