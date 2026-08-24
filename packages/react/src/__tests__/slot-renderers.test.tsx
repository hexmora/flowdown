import type { Element } from 'hast';

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { SlotProvider } from '../components/slot-provider';
import { PRESET_SLOT_PLUGINS } from '../plugins';
import { CodeBlockRenderer } from '../plugins/slot/code-block/renderer';
import { ImageRenderer } from '../plugins/slot/image/renderer';
import { LinkRenderer } from '../plugins/slot/link/renderer';

const node: Element = {
  type: 'element',
  tagName: 'span',
  properties: {},
  children: [],
};

const CodeBlockHarness = ({ loading }: { loading: boolean }) => {
  return (
    <SlotProvider plugins={PRESET_SLOT_PLUGINS}>
      <CodeBlockRenderer code="value" language="ts" loading={loading} />
    </SlotProvider>
  );
};

describe('minimal slot renderers', () => {
  test('exposes CodeBlock loading state through native accessibility semantics', () => {
    const { container, rerender } = render(<CodeBlockHarness loading />);
    const codeBlock = container.firstElementChild;

    expect(codeBlock).toHaveAttribute('aria-busy', 'true');

    rerender(<CodeBlockHarness loading={false} />);

    expect(codeBlock).not.toHaveAttribute('aria-busy');
  });

  test('preserves safe relative links and image sources', () => {
    render(
      <>
        <LinkRenderer current={node} href="/docs/start" parents={[]} render={() => null}>
          Documentation
        </LinkRenderer>
        <ImageRenderer
          alt="Diagram"
          current={node}
          parents={[]}
          render={() => null}
          src="./diagram.png"
        />
      </>,
    );

    expect(screen.getByRole('link', { name: 'Documentation' })).toHaveAttribute(
      'href',
      '/docs/start',
    );
    expect(screen.getByRole('img', { name: 'Diagram' })).toHaveAttribute('src', './diagram.png');
  });

  test('does not expose executable URL schemes', () => {
    render(
      <>
        <LinkRenderer current={node} href="javascript:alert(1)" parents={[]} render={() => null}>
          Unsafe link
        </LinkRenderer>
        <ImageRenderer
          alt="Unsafe image"
          current={node}
          parents={[]}
          render={() => null}
          src="data:text/html,unsafe"
        />
      </>,
    );

    expect(screen.getByText('Unsafe link').closest('a')).not.toHaveAttribute('href');
    expect(screen.getByRole('img', { name: 'Unsafe image' })).not.toHaveAttribute('src');
  });
});
