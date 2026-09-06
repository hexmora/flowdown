import type { Element } from 'hast';

import { render, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { TexRenderer } from '../renderer';

const node: Element = {
  type: 'element',
  tagName: 'span',
  properties: {},
  children: [],
};

const nodeProps = { current: node, parents: [], render: () => null };

describe('lazy math rendering', () => {
  test('keeps a lightweight source fallback until KaTeX loads', async () => {
    const { container } = render(
      <TexRenderer Raw={null} {...nodeProps} className="custom-tex" tex="x^2" />,
    );

    expect(container.textContent).toBe('x^2');
    expect(container.firstElementChild).toHaveClass('custom-tex');

    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());

    expect(container.firstElementChild).toHaveAttribute('data-mode', 'inline');
    expect(container.firstElementChild).toHaveClass('custom-tex');
    expect(container.querySelector('math')).not.toBeNull();
  });

  test('honors display mode and preserves root styling', async () => {
    const { container } = render(
      <TexRenderer
        Raw={null}
        {...nodeProps}
        className="display-tex"
        mode="display"
        style={{ marginTop: 12 }}
        tex={'\\frac{1}{2}'}
      />,
    );

    await waitFor(() => expect(container.querySelector('.katex-display')).not.toBeNull());

    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.firstElementChild).toHaveClass('display-tex');
    expect(container.firstElementChild).toHaveStyle({ marginTop: '12px' });
  });

  test('loads MathJax for expressions that KaTeX does not support', async () => {
    const { container } = render(<TexRenderer Raw={null} {...nodeProps} tex={'\\bbox[5px]{x}'} />);

    await waitFor(() => expect(container.querySelector('mjx-container svg')).not.toBeNull());

    expect(container.firstElementChild).toHaveAttribute('role', 'math');
    expect(container.firstElementChild).toHaveAttribute('aria-label', '\\bbox[5px]{x}');
  });

  test('keeps invalid expressions readable and escapes the source', async () => {
    const tex = '\\notARealCommand{<script>alert(1)</script>}';
    const { container } = render(<TexRenderer Raw={null} {...nodeProps} tex={tex} />);

    await waitFor(() =>
      expect(container.firstElementChild).toHaveAttribute('data-formula-error', 'true'),
    );

    expect(container.textContent).toBe(tex);
    expect(container.querySelector('script')).toBeNull();
  });

  test('filters unsafe links through the MathJax fallback', async () => {
    const { container } = render(
      <TexRenderer Raw={null} {...nodeProps} tex={'\\bbox[5px]{\\href{javascript:alert(1)}{x}}'} />,
    );

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    expect(container.querySelector('[href], [xlink\\:href]')).toBeNull();
  });
});
