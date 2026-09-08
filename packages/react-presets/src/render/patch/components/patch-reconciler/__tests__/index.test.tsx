import type { IRenderPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';
import { MutableState } from 'reactive';
import { describe, expect, test } from 'vitest';

import { PatchReconciler } from '..';

type RenderPatch = IRenderPatchItem<ReactNode>;

const createRender = (label: string) => (text?: string) => (
  <output aria-label="patch output">
    {label}:{text}
  </output>
);

describe('PatchReconciler', () => {
  test('updates a selected render callback and handles removal and reinsertion', () => {
    const firstRender = createRender('first');

    const secondRender = createRender('second');

    const thirdRender = createRender('third');

    const patches = MutableState.of<RenderPatch[]>([{ key: 'selected', render: firstRender }]);

    render(<PatchReconciler patchKey="selected" patches={patches} text="text" />);

    expect(screen.getByRole('status', { name: 'patch output' })).toHaveTextContent('first:text');

    act(() => {
      patches.next([{ key: 'selected', render: secondRender }]);
    });

    expect(screen.getByRole('status', { name: 'patch output' })).toHaveTextContent('second:text');

    act(() => {
      patches.next([]);
    });

    expect(screen.queryByRole('status', { name: 'patch output' })).not.toBeInTheDocument();

    act(() => {
      patches.next([{ key: 'selected', render: thirdRender }]);
    });

    expect(screen.getByRole('status', { name: 'patch output' })).toHaveTextContent('third:text');
  });

  test('renders text prop changes without a patch store update', () => {
    const selectedRender = createRender('selected');

    const patches = MutableState.of<RenderPatch[]>([{ key: 'selected', render: selectedRender }]);

    const view = render(<PatchReconciler patchKey="selected" patches={patches} text="before" />);

    view.rerender(<PatchReconciler patchKey="selected" patches={patches} text="after" />);

    expect(screen.getByRole('status', { name: 'patch output' })).toHaveTextContent(
      'selected:after',
    );
  });
});
