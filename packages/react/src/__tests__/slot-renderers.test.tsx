import type { Element } from 'hast';

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { SlotProvider } from '../components/slot-provider';
import { Flowdown } from '../index';
import { PRESET_SLOT_PLUGINS } from '../plugins';
import { CodeBlockRenderer } from '../plugins/slot/code-block/renderer';
import { HeadingRenderer } from '../plugins/slot/heading/renderer';
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
      <CodeBlockRenderer Raw={null} code="value" language="ts" loading={loading} />
    </SlotProvider>
  );
};

describe('minimal slot renderers', () => {
  test('preserves the starting number of an ordered Markdown list', () => {
    render(<Flowdown text={'3. Third step\n4. Fourth step'} />);

    expect(screen.getByRole('list')).toHaveAttribute('start', '3');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  test('forwards heading DOM attributes without exposing slot internals', () => {
    const props = {
      'aria-label': 'Review section',
      className: 'consumer-heading',
      current: node,
      'data-section': 'review',
      id: 'review-heading',
      level: 2,
      parents: [],
      Raw: () => null,
      render: () => null,
      style: { color: 'purple' },
    };

    render(<HeadingRenderer {...props}>Review</HeadingRenderer>);

    const heading = screen.getByRole('heading', { name: 'Review section' });

    expect(heading).toHaveAttribute('id', 'review-heading');
    expect(heading).toHaveAttribute('data-section', 'review');
    expect(heading).toHaveClass('consumer-heading');
    expect(heading).toHaveStyle({ color: 'rgb(128, 0, 128)' });
    expect(heading).not.toHaveAttribute('current');
    expect(heading).not.toHaveAttribute('parents');
    expect(heading).not.toHaveAttribute('render');
    expect(heading).not.toHaveAttribute('raw');
  });

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
        <LinkRenderer Raw={null} current={node} href="/docs/start" parents={[]} render={() => null}>
          Documentation
        </LinkRenderer>
        <ImageRenderer
          Raw={null}
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
        <LinkRenderer
          Raw={null}
          current={node}
          href="javascript:alert(1)"
          parents={[]}
          render={() => null}
        >
          Unsafe link
        </LinkRenderer>
        <ImageRenderer
          Raw={null}
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

  test('renders email autolinks without allowing email URLs as image sources', () => {
    render(
      <>
        <Flowdown text="<hello@example.com>" />
        <ImageRenderer
          Raw={null}
          alt="Invalid source"
          current={node}
          parents={[]}
          render={() => null}
          src="mailto:hello@example.com"
        />
      </>,
    );

    expect(screen.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
    expect(screen.getByRole('img')).not.toHaveAttribute('src');
  });

  test('preserves HTTP URLs and updates memoized links and images when their sources change', () => {
    const nodeProps = { current: node, parents: [], render: () => null };
    const view = render(
      <>
        <LinkRenderer
          Raw={null}
          {...nodeProps}
          href="http://example.com/docs"
          title="Documentation"
        >
          Documentation
        </LinkRenderer>
        <ImageRenderer
          Raw={null}
          {...nodeProps}
          alt="Diagram"
          src="http://example.com/diagram.png"
        />
        <ImageRenderer
          Raw={null}
          {...nodeProps}
          alt="Relative protocol"
          src="//example.com/diagram.png"
        />
      </>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', 'http://example.com/docs');
    expect(screen.getByRole('link')).toHaveAttribute('title', 'Documentation');
    expect(screen.getByRole('img', { name: 'Diagram' })).toHaveAttribute(
      'src',
      'http://example.com/diagram.png',
    );
    expect(screen.getByRole('img', { name: 'Relative protocol' })).toHaveAttribute(
      'src',
      '//example.com/diagram.png',
    );

    view.rerender(
      <>
        <LinkRenderer Raw={null} {...nodeProps} href="#notes">
          Documentation
        </LinkRenderer>
        <ImageRenderer Raw={null} {...nodeProps} alt="Diagram" src="javascript:alert(1)" />
      </>,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '#notes');
    expect(screen.getByRole('img')).not.toHaveAttribute('src');
  });
});
