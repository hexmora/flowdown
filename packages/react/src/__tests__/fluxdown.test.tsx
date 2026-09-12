import type { AnySlotPluggable, IReactRenderPluggable } from '@fluxdown/react-presets/base';
import type { IPluggable, IRemarkPlugin } from '@fluxdown/types';

import { PluginPriority } from '@fluxdown/types';
import { render, screen, waitFor, within } from '@testing-library/react';
import { type ComponentType, createRef, type ReactNode, StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { FluxdownRef } from '../types';

import { Fluxdown } from '..';

type RemarkPluggable = IPluggable<IRemarkPlugin, unknown>;

interface ParagraphSlotProps {
  Raw: ComponentType<Omit<ParagraphSlotProps, 'Raw'>> | null;
  children?: ReactNode;
}

const createParagraphSlotPlugin = (
  key: string,
  Component: ComponentType<ParagraphSlotProps>,
): AnySlotPluggable => {
  class TestParagraphSlotPlugin {
    static readonly key = key;

    readonly config = {};

    readonly type = 'Paragraph' as const;

    readonly Component = Component;

    destroy() {}
  }

  return TestParagraphSlotPlugin as unknown as AnySlotPluggable;
};

const NestedSlotA = ({ children }: ParagraphSlotProps) => (
  <span data-testid="fluxdown-slot-a">A[{children}]</span>
);

const NestedSlotB = ({ Raw, children }: ParagraphSlotProps) => (
  <span data-testid="fluxdown-slot-b">B[{Raw ? <Raw>{children}</Raw> : children}]</span>
);

const IsolatedSlotA = ({ children }: ParagraphSlotProps) => (
  <span data-testid="isolated-fluxdown-a">A[{children}]</span>
);

const IsolatedSlotB = ({ children }: ParagraphSlotProps) => (
  <span data-testid="isolated-fluxdown-b">B[{children}]</span>
);

describe('Fluxdown', () => {
  test('renders Markdown synchronously during server rendering', () => {
    const markup = renderToStaticMarkup(<Fluxdown text="# Server heading" />);

    expect(markup).toMatch(/<h1[^>]*>Server heading<\/h1>/);
  });

  test('renders common Markdown through styled preset slots', () => {
    const text = [
      '# Heading',
      '',
      'A **strong** and *emphasized* [link](https://example.com) with `code`.',
      '',
      '> quote',
      '',
      '1. first',
      '2. second',
      '',
      '---',
      '',
      '```ts',
      'const answer = 42;',
      '```',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
    ].join('\n');

    const { container } = render(<Fluxdown text={text} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading');
    expect(container.querySelector('p')).toHaveTextContent(
      'A strong and emphasized link with code.',
    );
    expect(container.querySelector('strong')).toHaveTextContent('strong');
    expect(container.querySelector('em')).toHaveTextContent('emphasized');
    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(container.querySelector('blockquote')).toHaveTextContent('quote');
    expect(container.querySelector('ol')).toHaveTextContent('first second');
    expect(container.querySelector('hr')).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent('const answer = 42;');
    expect(container.querySelector('table')).toHaveTextContent('AB12');
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
  });

  test('keeps one div root while forwarding reactive className and style', () => {
    const { container, rerender } = render(
      <Fluxdown className="consumer-root" style={{ color: 'red' }} text="hello" />,
    );
    const root = container.firstElementChild;

    expect(root?.tagName).toBe('DIV');
    expect(root).toHaveClass('fluxdown-root');
    expect(root).toHaveClass('consumer-root');
    expect(root).toHaveStyle({ color: 'rgb(255, 0, 0)' });

    rerender(<Fluxdown className="updated-root" style={{ color: 'blue' }} text="hello" />);

    expect(container.firstElementChild).toBe(root);
    expect(root).toHaveClass('updated-root');
    expect(root).not.toHaveClass('consumer-root');
    expect(root).toHaveStyle({ color: 'rgb(0, 0, 255)' });
  });

  test('renders images, hard breaks, and readable Tex while engines load', () => {
    const text = [
      '![diagram](http://example.com/diagram.png "Diagram")',
      '',
      'first line  ',
      'second line',
      '',
      '$x + y$',
    ].join('\n');

    const { container } = render(<Fluxdown build={{ tex: true }} text={text} />);
    const image = screen.getByRole('img', { name: 'diagram' });

    expect(image).toHaveAttribute('src', 'http://example.com/diagram.png');
    expect(image).toHaveAttribute('title', 'Diagram');
    expect(container.querySelector('br')).toBeInTheDocument();
    expect(container).toHaveTextContent('x + y');
  });

  test('uses slot plugins supplied through aggregated plugin packs', () => {
    render(
      <Fluxdown
        text="hello"
        plugins={[
          {
            slots: [
              createParagraphSlotPlugin('fluxdown-slot-a', NestedSlotA),
              createParagraphSlotPlugin('fluxdown-slot-b', NestedSlotB),
            ],
          },
        ]}
      />,
    );

    expect(screen.getByTestId('fluxdown-slot-a')).toBeInTheDocument();
    expect(screen.getByTestId('fluxdown-slot-b')).toHaveTextContent('B[A[hello]]');
  });

  test('isolates slot plugin composition between Fluxdown instances', () => {
    const pluginA = createParagraphSlotPlugin('isolated-fluxdown-a', IsolatedSlotA);
    const pluginB = createParagraphSlotPlugin('isolated-fluxdown-b', IsolatedSlotB);

    render(
      <>
        <section data-testid="first-fluxdown">
          <Fluxdown text="first" plugins={[{ slots: [pluginA] }]} />
        </section>
        <section data-testid="second-fluxdown">
          <Fluxdown text="second" plugins={[{ slots: [pluginB] }]} />
        </section>
      </>,
    );

    const first = within(screen.getByTestId('first-fluxdown'));
    const second = within(screen.getByTestId('second-fluxdown'));

    expect(first.getByTestId('isolated-fluxdown-a')).toHaveTextContent('A[first]');
    expect(first.queryByTestId('isolated-fluxdown-b')).not.toBeInTheDocument();
    expect(second.getByTestId('isolated-fluxdown-b')).toHaveTextContent('B[second]');
    expect(second.queryByTestId('isolated-fluxdown-a')).not.toBeInTheDocument();
  });

  test('gives custom render plugins a match opportunity before the fallback renderer', () => {
    type RenderNode = { type: string; value?: string };
    let captured:
      | {
          node: RenderNode;
          parents: unknown[];
        }
      | undefined;

    class CustomTextRenderPlugin {
      static readonly key = 'test-custom-text-render';

      readonly config = { priority: PluginPriority.Lowest };

      match({ node }: { node: RenderNode }) {
        return node.type === 'text' && node.value === 'custom-token';
      }

      render({ node, parents }: { node: RenderNode; parents: unknown[] }) {
        captured = { node, parents };

        return <u data-testid="custom-render">CUSTOM:{node.value}</u>;
      }

      destroy() {}
    }

    render(
      <Fluxdown
        text="custom-token"
        plugins={[
          {
            renders: [CustomTextRenderPlugin as unknown as IReactRenderPluggable],
          },
        ]}
      />,
    );

    expect(screen.getByTestId('custom-render')).toHaveTextContent('CUSTOM:custom-token');
    expect(captured).toBeDefined();
    expect(captured?.parents).not.toContain(captured?.node);
  });

  test('maps reactive plugin-pack config entries to constructor configuration', async () => {
    const pluginKey = 'test-configured-remark';
    let receivedConfig: unknown;

    class ConfiguredRemarkPlugin {
      static readonly key = pluginKey;

      readonly config = {};

      private readonly suffix: string;

      constructor(config: { suffix?: string } = {}) {
        receivedConfig = config;
        this.suffix = config.suffix ?? '';
      }

      readonly plugin = () => (tree: { children: unknown[] }) => {
        tree.children.push({
          type: 'paragraph',
          children: [{ type: 'text', value: this.suffix }],
        });
      };

      destroy() {}
    }

    const renderConfigured = (suffix: string) => (
      <Fluxdown
        text="base"
        plugins={[
          {
            config: {
              [pluginKey]: { suffix },
            },
            remarks: [ConfiguredRemarkPlugin as unknown as RemarkPluggable],
          },
        ]}
      />
    );
    const { rerender } = render(renderConfigured('|configured'));

    expect(receivedConfig).toEqual({ suffix: '|configured' });
    expect(screen.getByText('|configured')).toBeInTheDocument();

    rerender(renderConfigured('|updated'));

    await waitFor(() => {
      expect(receivedConfig).toEqual({ suffix: '|updated' });
      expect(screen.getByText('|updated')).toBeInTheDocument();
    });
  });

  test('keeps an empty root for blank Markdown', () => {
    const { container } = render(<Fluxdown text={'\n \n'} />);
    const root = container.firstElementChild;

    expect(root).toBeEmptyDOMElement();
  });

  test('keeps the core closure ref stable, updates text, and destroys it on unmount', async () => {
    const ref = createRef<FluxdownRef>();
    const { rerender, unmount } = render(<Fluxdown ref={ref} text="alpha" />);

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(ref.current).not.toBeNull();
    expect(ref.current?.value).toBeDefined();

    const closure = ref.current;
    const destroy = jest.spyOn(closure!, 'destroy');
    const firstBlock = screen.getByText('alpha');

    rerender(<Fluxdown ref={ref} text={'alpha\n\nbeta'} />);

    await waitFor(() => {
      expect(screen.getByText('beta')).toBeInTheDocument();
    });

    expect(ref.current).toBe(closure);
    expect(screen.getByText('alpha')).toBe(firstBlock);
    expect(
      [...(screen.getByText('alpha').parentElement?.children ?? [])].map(
        (element) => element.textContent,
      ),
    ).toEqual(['alpha', 'beta']);

    unmount();

    await waitFor(() => {
      expect(destroy).toHaveBeenCalledTimes(1);
      expect(closure?.value.closed).toBe(true);
    });
  });

  test('updates a changed ref when memoized props stay equal', () => {
    const firstRef = createRef<FluxdownRef>();
    const secondRef = createRef<FluxdownRef>();
    const { rerender } = render(<Fluxdown ref={firstRef} text="stable" />);
    const closure = firstRef.current;

    expect(closure).not.toBeNull();

    rerender(<Fluxdown ref={secondRef} text="stable" />);

    expect(firstRef.current).toBeNull();
    expect(secondRef.current).toBe(closure);
  });

  test('keeps the rendered block element mounted while text streams within that block', async () => {
    const { container, rerender } = render(<Fluxdown text="stream" />);
    const paragraph = container.querySelector('p');

    rerender(<Fluxdown text="stream continues" />);

    await waitFor(() => {
      expect(container).toHaveTextContent('stream continues');
    });

    expect(container.querySelector('p')).toBe(paragraph);
  });

  test('survives StrictMode effect replay, updates once, and destroys the committed closure once', async () => {
    let closure: FluxdownRef | undefined;
    let destroyCalls = 0;

    const captureRef = (value: FluxdownRef | null) => {
      if (!value || closure) {
        return;
      }

      closure = value;
      const destroy = value.destroy.bind(value);

      value.destroy = () => {
        destroyCalls += 1;
        destroy();
      };
    };
    const view = render(
      <StrictMode>
        <Fluxdown ref={captureRef} text="strict-alpha" />
      </StrictMode>,
    );

    expect(screen.getByText('strict-alpha')).toBeInTheDocument();
    expect(closure).toBeDefined();

    view.rerender(
      <StrictMode>
        <Fluxdown ref={captureRef} text="strict-beta" />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByText('strict-beta')).toBeInTheDocument();
    });

    view.unmount();

    await waitFor(() => {
      expect(destroyCalls).toBe(1);
    });
  });
});
