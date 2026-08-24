import type { IPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Flowdown } from '..';

const isCrossComponentRenderWarning = (value: unknown) =>
  typeof value === 'string' &&
  value.includes('Cannot update a component') &&
  value.includes('while rendering a different component');

const hasCrossComponentRenderWarning = (calls: readonly (readonly unknown[])[]) =>
  calls.some((values) => values.some(isCrossComponentRenderWarning));

const createPatches = (label: string): IPatchItem<ReactNode>[] => [
  {
    key: 'stable-render-callback',
    range: [6, 11],
    render: (text?: string) => (
      <mark>
        {label}:{text}
      </mark>
    ),
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Flowdown render-phase updates', () => {
  test('updates text after mount without notifying another component during render', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(<Flowdown text="alpha" />);

    expect(screen.getByText('alpha')).toBeInTheDocument();

    view.rerender(<Flowdown text="beta" />);

    await waitFor(() => {
      expect(screen.getByText('beta')).toBeInTheDocument();
    });

    expect(hasCrossComponentRenderWarning(consoleError.mock.calls)).toBe(false);
  });

  test('replaces only a stable-range patch callback without notifying during render', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const view = render(<Flowdown patches={createPatches('first')} text="Hello world" />);

    expect(screen.getByText('first:world')).toBeInTheDocument();

    view.rerender(<Flowdown patches={createPatches('second')} text="Hello world" />);

    await waitFor(() => {
      expect(screen.getByText('second:world')).toBeInTheDocument();
    });

    expect(hasCrossComponentRenderWarning(consoleError.mock.calls)).toBe(false);
  });
});
