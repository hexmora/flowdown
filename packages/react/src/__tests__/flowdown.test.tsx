import { PluginPriority } from '@flowdown/types';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { type ComponentType, createRef, type ReactNode, StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import type { FlowdownRef, IPluginItem } from '../types';

import { Flowdown } from '..';

type RemarkPluggable = NonNullable<IPluginItem['remarks']>[number];
type RenderPluggable = NonNullable<IPluginItem['renders']>[number];
type SlotPluggable = NonNullable<IPluginItem['slots']>[number];

interface ParagraphSlotProps {
  Raw?: ComponentType<ParagraphSlotProps> | null;
  children?: ReactNode;
}

const createParagraphSlotPlugin = (
  key: string,
  Component: ComponentType<ParagraphSlotProps>,
): SlotPluggable => {
  class TestParagraphSlotPlugin {
    static readonly key = key;

    readonly config = {};

    readonly type = 'Paragraph' as const;

    readonly Component = Component;

    destroy() {}
  }

  return TestParagraphSlotPlugin as unknown as SlotPluggable;
};

const NestedSlotA = ({ children }: ParagraphSlotProps) => (
  <span data-testid="flowdown-slot-a">A[{children}]</span>
);

const NestedSlotB = ({ Raw, children }: ParagraphSlotProps) => (
  <span data-testid="flowdown-slot-b">B[{Raw ? <Raw>{children}</Raw> : children}]</span>
);

const IsolatedSlotA = ({ children }: ParagraphSlotProps) => (
  <span data-testid="isolated-flowdown-a">A[{children}]</span>
);

const IsolatedSlotB = ({ children }: ParagraphSlotProps) => (
  <span data-testid="isolated-flowdown-b">B[{children}]</span>
);

describe('Flowdown', () => {
  test('renders Markdown synchronously during server rendering', () => {
    const setInterval = vi.fn();

    vi.stubGlobal('document', undefined);
    vi.stubGlobal('setInterval', setInterval);

    try {
      const markup = renderToStaticMarkup(<Flowdown text="# Server heading" />);

      const smoothMarkup = renderToStaticMarkup(<Flowdown smooth text="# Smooth server heading" />);

      expect(markup).toContain('<h1>Server heading</h1>');
      expect(smoothMarkup).toContain('<h1>Smooth server heading</h1>');
      expect(setInterval).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('renders common Markdown through semantic, unstyled preset slots', () => {
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

    const { container } = render(<Flowdown text={text} />);

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
      <Flowdown className="consumer-root" style={{ color: 'red' }} text="hello" />,
    );
    const root = container.firstElementChild;

    expect(root?.tagName).toBe('DIV');
    expect(root).toHaveClass('consumer-root');
    expect(root).toHaveStyle({ color: 'rgb(255, 0, 0)' });

    rerender(<Flowdown className="updated-root" style={{ color: 'blue' }} text="hello" />);

    expect(container.firstElementChild).toBe(root);
    expect(root).toHaveClass('updated-root');
    expect(root).not.toHaveClass('consumer-root');
    expect(root).toHaveStyle({ color: 'rgb(0, 0, 255)' });
  });

  test('renders image, hard-break, and raw Tex slots without styling engines', () => {
    const text = [
      '![diagram](http://example.com/diagram.png "Diagram")',
      '',
      'first line  ',
      'second line',
      '',
      '$x + y$',
    ].join('\n');
    const { container } = render(<Flowdown build={{ tex: true }} text={text} />);
    const image = screen.getByRole('img', { name: 'diagram' });

    expect(image).toHaveAttribute('src', 'https://example.com/diagram.png');
    expect(image).toHaveAttribute('title', 'Diagram');
    expect(container.querySelector('br')).toBeInTheDocument();
    expect(container).toHaveTextContent('x + y');
  });

  test('uses slot plugins supplied through aggregated plugin packs', () => {
    render(
      <Flowdown
        text="hello"
        plugins={[
          {
            slots: [
              createParagraphSlotPlugin('flowdown-slot-a', NestedSlotA),
              createParagraphSlotPlugin('flowdown-slot-b', NestedSlotB),
            ],
          },
        ]}
      />,
    );

    expect(screen.getByTestId('flowdown-slot-a')).toBeInTheDocument();
    expect(screen.getByTestId('flowdown-slot-b')).toHaveTextContent('B[A[hello]]');
  });

  test('isolates slot plugin composition between Flowdown instances', () => {
    const pluginA = createParagraphSlotPlugin('isolated-flowdown-a', IsolatedSlotA);
    const pluginB = createParagraphSlotPlugin('isolated-flowdown-b', IsolatedSlotB);

    render(
      <>
        <section data-testid="first-flowdown">
          <Flowdown text="first" plugins={[{ slots: [pluginA] }]} />
        </section>
        <section data-testid="second-flowdown">
          <Flowdown text="second" plugins={[{ slots: [pluginB] }]} />
        </section>
      </>,
    );

    const first = within(screen.getByTestId('first-flowdown'));
    const second = within(screen.getByTestId('second-flowdown'));

    expect(first.getByTestId('isolated-flowdown-a')).toHaveTextContent('A[first]');
    expect(first.queryByTestId('isolated-flowdown-b')).not.toBeInTheDocument();
    expect(second.getByTestId('isolated-flowdown-b')).toHaveTextContent('B[second]');
    expect(second.queryByTestId('isolated-flowdown-a')).not.toBeInTheDocument();
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
      <Flowdown
        text="custom-token"
        plugins={[
          {
            renders: [CustomTextRenderPlugin as unknown as RenderPluggable],
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
      <Flowdown
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
    const { container } = render(<Flowdown text={'\n \n'} />);
    const root = container.firstElementChild;

    expect(root).toBeEmptyDOMElement();
  });

  test('keeps the core closure ref stable, updates text, and destroys it on unmount', async () => {
    const ref = createRef<FlowdownRef>();
    const { rerender, unmount } = render(<Flowdown ref={ref} text="alpha" />);

    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(ref.current).not.toBeNull();
    expect(ref.current?.value).toBeDefined();

    const closure = ref.current;
    const destroy = vi.spyOn(closure!, 'destroy');
    const firstBlock = screen.getByText('alpha');

    rerender(<Flowdown ref={ref} text={'alpha\n\nbeta'} />);

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
      expect(destroy).toHaveBeenCalledOnce();
      expect(closure?.value.closed).toBe(true);
    });
  });

  test('updates a changed ref when memoized props stay equal', () => {
    const firstRef = createRef<FlowdownRef>();
    const secondRef = createRef<FlowdownRef>();
    const { rerender } = render(<Flowdown ref={firstRef} text="stable" />);
    const closure = firstRef.current;

    expect(closure).not.toBeNull();

    rerender(<Flowdown ref={secondRef} text="stable" />);

    expect(firstRef.current).toBeNull();
    expect(secondRef.current).toBe(closure);
  });

  test('keeps the rendered block element mounted while text streams within that block', async () => {
    const { container, rerender } = render(<Flowdown text="stream" />);
    const paragraph = container.querySelector('p');

    rerender(<Flowdown text="stream continues" />);

    await waitFor(() => {
      expect(container).toHaveTextContent('stream continues');
    });

    expect(container.querySelector('p')).toBe(paragraph);
  });

  test('keeps smoothing disabled by default and when object enabled is omitted', async () => {
    const requestFrame = vi.fn();

    vi.stubGlobal('requestAnimationFrame', requestFrame);

    try {
      const view = render(<Flowdown text="" />);

      view.rerender(<Flowdown text="default stream" />);

      await waitFor(() => {
        expect(view.container).toHaveTextContent('default stream');
      });

      view.rerender(
        <Flowdown smooth={{ scheduler: 'spring', ticker: 'raf' }} text="object stream" />,
      );

      await waitFor(() => {
        expect(view.container).toHaveTextContent('object stream');
      });

      expect(requestFrame).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('smooths appended text and flushes the pending suffix when smoothing is disabled', async () => {
    type FrameCallback = (timestamp: number) => void;

    let frameCallback: FrameCallback | undefined;

    let frameId = 0;

    const requestFrame = vi.fn((callback: FrameCallback) => {
      frameCallback = callback;

      frameId += 1;

      return frameId;
    });
    const cancelFrame = vi.fn();

    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    try {
      const view = render(<Flowdown smooth text="" />);
      const root = view.container.firstElementChild;

      expect(requestFrame).toHaveBeenCalledOnce();

      view.rerender(<Flowdown smooth text="abc" />);

      expect(root).toBeEmptyDOMElement();
      expect(requestFrame).toHaveBeenCalledOnce();

      await act(async () => {
        for (let timestamp = 16; timestamp <= 6_400; timestamp += 16) {
          const currentFrame = frameCallback;

          frameCallback = undefined;

          currentFrame?.(timestamp);

          if (root?.textContent === 'abc') {
            break;
          }
        }
      });

      expect(root).toHaveTextContent('abc');

      view.rerender(<Flowdown smooth text="abcdef" />);

      expect(root).toHaveTextContent('abc');

      view.rerender(<Flowdown smooth={false} text="abcdef" />);

      await waitFor(() => {
        expect(root).toHaveTextContent('abcdef');
      });

      expect(cancelFrame).toHaveBeenCalledOnce();

      view.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('keeps completed Markdown blocks mounted across smooth ticks and cancels active RAF', async () => {
    type FrameCallback = (timestamp: number) => void;

    let frameCallback: FrameCallback | undefined;

    let frameId = 0;

    const requestFrame = vi.fn((callback: FrameCallback) => {
      frameCallback = callback;

      frameId += 1;

      return frameId;
    });
    const cancelFrame = vi.fn();

    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    const view = render(<Flowdown smooth text="first" />);

    try {
      const firstParagraph = view.container.querySelector('p');

      view.rerender(<Flowdown smooth text={'first\n\nsecond'} />);

      expect(view.container).toHaveTextContent('first');
      expect(view.container).not.toHaveTextContent('second');

      await act(async () => {
        for (let timestamp = 16; timestamp <= 10_000; timestamp += 16) {
          const currentFrame = frameCallback;

          frameCallback = undefined;

          currentFrame?.(timestamp);

          if (view.container.textContent === 'firstsecond') {
            break;
          }
        }
      });

      expect(screen.getByText('second')).toBeInTheDocument();
      expect(view.container.querySelector('p')).toBe(firstParagraph);

      view.rerender(<Flowdown smooth text={'first\n\nsecond plus'} />);

      expect(view.container).not.toHaveTextContent('plus');

      view.unmount();

      await waitFor(() => {
        expect(cancelFrame).toHaveBeenCalledOnce();
      });
    } finally {
      view.unmount();

      vi.unstubAllGlobals();
    }
  });

  test('survives StrictMode effect replay, updates once, and destroys the committed closure once', async () => {
    let closure: FlowdownRef | undefined;
    let destroyCalls = 0;

    const captureRef = (value: FlowdownRef | null) => {
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
        <Flowdown ref={captureRef} text="strict-alpha" />
      </StrictMode>,
    );

    expect(screen.getByText('strict-alpha')).toBeInTheDocument();
    expect(closure).toBeDefined();

    view.rerender(
      <StrictMode>
        <Flowdown ref={captureRef} text="strict-beta" />
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
