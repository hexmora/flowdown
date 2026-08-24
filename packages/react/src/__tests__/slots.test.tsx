import type { Element } from 'hast';
import type { ComponentType, ReactNode } from 'react';

import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { has, keys } from 'lodash-es';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { AnySlotPluggable, Slots, SlotType } from '../types';

import { createTypeOfSlot, SlotProvider } from '../components';
import { useSlots } from '../hooks';

interface SlotComponentProps {
  Raw?: ComponentType<SlotComponentProps> | null;
  children?: ReactNode;
  error?: unknown;
  onReset?: () => void;
  props?: unknown;
  type?: string;
}

interface LifecycleCounts {
  created: number;
  destroyed: number;
}

const paragraphNode: Element = {
  type: 'element',
  tagName: 'p',
  properties: {},
  children: [],
};

const Paragraph = createTypeOfSlot('Paragraph');

const createSlotPlugin = (
  key: string,
  type: SlotType,
  Component: ComponentType<SlotComponentProps>,
): AnySlotPluggable => {
  class TestSlotPlugin {
    static readonly key = key;

    readonly config = {};

    readonly type = type;

    readonly Component = Component;

    destroy() {}
  }

  return TestSlotPlugin as unknown as AnySlotPluggable;
};

const createTrackedSlotPlugin = (
  key: string,
  counts: LifecycleCounts,
  Component: ComponentType<SlotComponentProps>,
): AnySlotPluggable => {
  class TrackedSlotPlugin {
    static readonly key = key;

    readonly config = {};

    readonly type = 'Paragraph';

    readonly Component = Component;

    constructor() {
      counts.created += 1;
    }

    destroy() {
      counts.destroyed += 1;
    }
  }

  return TrackedSlotPlugin as unknown as AnySlotPluggable;
};

const SlotHarness = ({ plugins }: { plugins: AnySlotPluggable[] }) => {
  return (
    <SlotProvider plugins={plugins}>
      <Paragraph current={paragraphNode} parents={[]} render={() => null}>
        content
      </Paragraph>
    </SlotProvider>
  );
};

const CompositionSlotA = ({ children }: SlotComponentProps) => (
  <span data-testid="slot-a">A[{children}]</span>
);

const CompositionSlotB = ({ Raw, children, ...props }: SlotComponentProps) => (
  <span data-testid="slot-b">B[{Raw ? <Raw {...props}>{children}</Raw> : children}]</span>
);

const CompositionSlotC = ({ Raw, children, ...props }: SlotComponentProps) => (
  <span data-testid="slot-c">C[{Raw ? <Raw {...props}>{children}</Raw> : children}]</span>
);

const FirstSlot = (props: SlotComponentProps) => (
  <span data-has-raw={String(has(props, 'Raw'))} data-testid="first-slot">
    {props.children}
  </span>
);

const IsolatedSlotA = ({ children }: SlotComponentProps) => <span>A[{children}]</span>;

const IsolatedSlotB = ({ children }: SlotComponentProps) => <span>B[{children}]</span>;

const ChangingSlotA = ({ children }: SlotComponentProps) => (
  <span data-testid="changing-slot-a">A[{children}]</span>
);

const ChangingSlotB = ({ children }: SlotComponentProps) => (
  <span data-testid="changing-slot-b">B[{children}]</span>
);

const WrappedParagraph = ({ children }: SlotComponentProps) => <p>{children}</p>;

const SlotWrapper = ({ children, type }: SlotComponentProps) => (
  <section data-testid="wrapper" data-slot-type={type}>
    {children}
  </section>
);

const BrokenSlot = () => {
  throw new Error('slot failed');
};

const ErrorFallback = ({ error, type }: SlotComponentProps) => (
  <output data-testid="fallback" data-slot-type={type}>
    {error instanceof Error ? error.message : 'unknown'}
  </output>
);

const EXPECTED_SLOT_ERRORS = ['retryable slot', 'slot failed'];

const suppressExpectedSlotError = (event: ErrorEvent) => {
  if (event.error instanceof Error && EXPECTED_SLOT_ERRORS.includes(event.error.message)) {
    event.preventDefault();
  }
};

beforeEach(() => {
  window.addEventListener('error', suppressExpectedSlotError);
});

afterEach(() => {
  window.removeEventListener('error', suppressExpectedSlotError);

  vi.restoreAllMocks();
});

describe('slots', () => {
  test('returns a dynamic partial map containing only declared slot types', () => {
    const emptySlots: Partial<Slots> = {};

    const empty = renderHook(() => useSlots([]));

    const paragraph = createSlotPlugin('partial-paragraph', 'Paragraph', WrappedParagraph);

    const declared = renderHook(() => useSlots([paragraph]));

    expect(empty.result.current).toEqual(emptySlots);

    expect(keys(empty.result.current)).toEqual([]);

    expect(keys(declared.result.current)).toEqual(['Paragraph']);

    expect(declared.result.current.Paragraph).toHaveLength(1);

    expect(declared.result.current.Fallback).toBeUndefined();

    expect(declared.result.current.Wrapper).toBeUndefined();

    expect(declared.result.current).not.toHaveProperty('SlotFallback');

    expect(declared.result.current).not.toHaveProperty('SlotWrapper');
  });

  test('composes repeated slots in declaration order through Raw', () => {
    render(
      <SlotHarness
        plugins={[
          createSlotPlugin('test-slot-a', 'Paragraph', CompositionSlotA),
          createSlotPlugin('test-slot-b', 'Paragraph', CompositionSlotB),
          createSlotPlugin('test-slot-c', 'Paragraph', CompositionSlotC),
        ]}
      />,
    );

    expect(screen.getByTestId('slot-a')).toBeInTheDocument();

    expect(screen.getByTestId('slot-b')).toBeInTheDocument();

    expect(screen.getByTestId('slot-c')).toHaveTextContent('C[B[A[content]]]');
  });

  test('does not inject a Raw prop into the first slot layer', () => {
    render(<SlotHarness plugins={[createSlotPlugin('first-slot', 'Paragraph', FirstSlot)]} />);

    expect(screen.getByTestId('first-slot')).toHaveAttribute('data-has-raw', 'false');
  });

  test('does not share mutable slot arrays between hook instances', () => {
    const pluginA = createSlotPlugin('isolated-a', 'Paragraph', IsolatedSlotA);

    const pluginB = createSlotPlugin('isolated-b', 'Paragraph', IsolatedSlotB);

    const first = renderHook(() => useSlots([pluginA]));

    const second = renderHook(() => useSlots([pluginB]));

    expect(first.result.current.Paragraph).toHaveLength(1);

    expect(second.result.current.Paragraph).toHaveLength(1);

    expect(first.result.current.Paragraph).not.toBe(second.result.current.Paragraph);
  });

  test('updates slot composition when the supplied plugin list changes', () => {
    const pluginA = createSlotPlugin('changing-a', 'Paragraph', ChangingSlotA);

    const pluginB = createSlotPlugin('changing-b', 'Paragraph', ChangingSlotB);

    const view = render(<SlotHarness plugins={[pluginA]} />);

    expect(screen.getByTestId('changing-slot-a')).toBeInTheDocument();

    view.rerender(<SlotHarness plugins={[pluginB]} />);

    expect(screen.queryByTestId('changing-slot-a')).not.toBeInTheDocument();

    expect(screen.getByTestId('changing-slot-b')).toHaveTextContent('B[content]');
  });

  test('destroys retired and mounted slot instances exactly once', async () => {
    const firstCounts: LifecycleCounts = { created: 0, destroyed: 0 };

    const secondCounts: LifecycleCounts = { created: 0, destroyed: 0 };

    const FirstPlugin = createTrackedSlotPlugin(
      'slot-lifecycle-first',
      firstCounts,
      ({ children }) => <span>{children}</span>,
    );

    const SecondPlugin = createTrackedSlotPlugin(
      'slot-lifecycle-second',
      secondCounts,
      ({ children }) => <span>{children}</span>,
    );

    const view = render(<SlotHarness plugins={[FirstPlugin, SecondPlugin]} />);

    expect(firstCounts).toEqual({ created: 1, destroyed: 0 });

    expect(secondCounts).toEqual({ created: 1, destroyed: 0 });

    view.rerender(<SlotHarness plugins={[SecondPlugin]} />);

    await waitFor(() => {
      expect(firstCounts).toEqual({ created: 1, destroyed: 1 });

      expect(secondCounts).toEqual({ created: 1, destroyed: 0 });
    });

    view.unmount();

    await waitFor(() => {
      expect(firstCounts).toEqual({ created: 1, destroyed: 1 });

      expect(secondCounts).toEqual({ created: 1, destroyed: 1 });
    });
  });

  test('applies Wrapper around a rendered slot and reports the slot type', () => {
    render(
      <SlotHarness
        plugins={[
          createSlotPlugin('test-paragraph', 'Paragraph', WrappedParagraph),
          createSlotPlugin('test-wrapper', 'Wrapper', SlotWrapper),
        ]}
      />,
    );

    expect(screen.getByTestId('wrapper')).toHaveAttribute('data-slot-type', 'Paragraph');

    expect(screen.getByTestId('wrapper')).toHaveTextContent('content');
  });

  test('renders Fallback when a named slot throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <SlotHarness
        plugins={[
          createSlotPlugin('test-broken', 'Paragraph', BrokenSlot),
          createSlotPlugin('test-fallback', 'Fallback', ErrorFallback),
        ]}
      />,
    );

    expect(screen.getByTestId('fallback')).toHaveAttribute('data-slot-type', 'Paragraph');

    expect(screen.getByTestId('fallback')).toHaveTextContent('slot failed');
  });

  test('passes original props and reset control to Fallback, then retries the slot', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    let shouldThrow = true;

    let capturedProps: unknown;

    let capturedReset: (() => void) | undefined;

    const Flaky = ({ children }: SlotComponentProps) => {
      if (shouldThrow) {
        throw new Error('retryable slot');
      }

      return <span data-testid="retried-slot">{children}</span>;
    };

    const Fallback = ({ error, onReset, props }: SlotComponentProps) => {
      capturedProps = props;

      capturedReset = onReset;

      return (
        <button
          data-testid="retry-fallback"
          onClick={() => {
            shouldThrow = false;

            onReset?.();
          }}
          type="button"
        >
          {error instanceof Error ? error.message : 'unknown'}
        </button>
      );
    };

    render(
      <SlotHarness
        plugins={[
          createSlotPlugin('test-flaky', 'Paragraph', Flaky),
          createSlotPlugin('test-retry-fallback', 'Fallback', Fallback),
        ]}
      />,
    );

    expect(screen.getByTestId('retry-fallback')).toHaveTextContent('retryable slot');

    expect(capturedProps).toMatchObject({ children: 'content' });

    expect(capturedReset).toBeTypeOf('function');

    fireEvent.click(screen.getByTestId('retry-fallback'));

    expect(screen.queryByTestId('retry-fallback')).not.toBeInTheDocument();

    expect(screen.getByTestId('retried-slot')).toHaveTextContent('content');
  });
});
