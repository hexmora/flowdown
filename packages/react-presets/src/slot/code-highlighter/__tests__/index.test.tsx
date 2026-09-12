import { render, waitFor } from '@testing-library/react';

import { PREFIX } from '../../../base';
import { CodeHighlighterRenderer } from '../renderer';
import { highlightCode } from '../renderer/utils';

describe('code highlighting', () => {
  test('loads language aliases and uses the runtime theme tokens', async () => {
    const source = 'const answer: number = 42;';
    const tokens = await highlightCode(source, 'TS');

    expect(
      tokens
        ?.flat()
        .map((token) => token.content)
        .join(''),
    ).toBe(source);
    expect(tokens?.flat().some((token) => token.color === `var(--${PREFIX}-syntax-keyword)`)).toBe(
      true,
    );
    expect(tokens?.flat().some((token) => token.color === `var(--${PREFIX}-syntax-number)`)).toBe(
      true,
    );
  });

  test('keeps unknown and prototype property languages as plaintext', async () => {
    expect(await highlightCode('<script>source</script>', 'unknown-language')).toBeNull();
    expect(await highlightCode('value', '__proto__')).toBeNull();
    expect(await highlightCode('value', 'plaintext')).toBeNull();
  });

  test('shares concurrent language loads', async () => {
    const [first, second] = await Promise.all([
      highlightCode('answer = 42', 'python'),
      highlightCode('answer = 43', 'python'),
    ]);

    expect(
      first
        ?.flat()
        .map((token) => token.content)
        .join(''),
    ).toBe('answer = 42');
    expect(
      second
        ?.flat()
        .map((token) => token.content)
        .join(''),
    ).toBe('answer = 43');
  });

  test('preserves source text, newlines, and root attributes without parsing source HTML', async () => {
    const code = '<script>alert("source")</script>\n\n';
    const { container } = render(
      <CodeHighlighterRenderer
        Raw={null}
        className="custom-code"
        code={code}
        language="html"
        style={{ maxHeight: 300 }}
      />,
    );

    await waitFor(() => expect(container.querySelector('code span')).not.toBeNull());

    expect(container.firstElementChild).toHaveClass('custom-code');
    expect(container.firstElementChild).toHaveStyle({ maxHeight: '300px' });
    expect(container.querySelector('code')).toHaveTextContent('alert("source")');
    expect(container.querySelector('code')?.textContent).toBe(code);
    expect(container.querySelector('script')).toBeNull();
  });

  test('shows the current source immediately when code or language changes', async () => {
    const { container, rerender } = render(
      <CodeHighlighterRenderer Raw={null} code="const oldValue = 1" language="javascript" />,
    );

    await waitFor(() => expect(container.querySelector('code span')).not.toBeNull());

    rerender(<CodeHighlighterRenderer Raw={null} code="replacement" language="unknown" />);

    expect(container.querySelector('code')?.textContent).toBe('replacement');
    expect(container.querySelector('code span')).toBeNull();
  });
});
