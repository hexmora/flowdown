import { texToSvg } from '../renderer/components/mathjax-tex/utils';

describe('MathJax synchronous SVG rendering', () => {
  test.each([
    ['AMS', String.raw`\begin{aligned}a&=b+c\\d&=e\end{aligned}`],
    ['chemistry', String.raw`\ce{H2O}`],
    ['physics', String.raw`\qty(\frac{x}{y})`],
    ['TeX font variants', String.raw`\mathbb{R} \quad \mathcal{L}`],
    ['custom macros', String.raw`\number{42}\unit{kg}\div\equalparallel`],
    ['MathJax extensions', String.raw`\bbox[red]{\cancel{x}}`],
  ])('renders %s across fresh inline and display documents', (_name, source) => {
    for (const mode of ['inline', 'display', 'inline'] as const) {
      const html = texToSvg(source, mode);

      expect(html).toContain('<svg');
      expect(html).not.toContain('data-mjx-error');
    }
  });

  test('does not allow formulas to set CSS classes or IDs', () => {
    const html = texToSvg(String.raw`\class{injected}{\cssId{injected}{x}}`, 'inline');
    const container = document.createElement('div');

    expect(html).toContain('<svg');
    container.innerHTML = html!;
    expect(container.querySelector('.injected, #injected')).toBeNull();
  });
});

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
