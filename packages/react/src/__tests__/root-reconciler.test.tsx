import { MutableState } from '@flowdown/reactive';
import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, test } from 'vitest';

import { RootReconciler } from '../components/root-reconciler';

describe('RootReconciler', () => {
  test('renders reactive children in one div and preserves keyed DOM while reordering', () => {
    const first = (
      <p data-testid="root-item-first" key="first">
        first
      </p>
    );

    const second = (
      <p data-testid="root-item-second" key="second">
        second
      </p>
    );

    const children = MutableState.of<ReactNode[]>([first, second]);

    const view = render(
      <RootReconciler className="initial-root" style={{ color: 'red' }}>
        {children}
      </RootReconciler>,
    );

    const root = view.container.firstElementChild;

    const firstElement = screen.getByTestId('root-item-first');

    const secondElement = screen.getByTestId('root-item-second');

    expect(root?.tagName).toBe('DIV');

    expect(root).toHaveClass('initial-root');

    expect(root).toHaveStyle({ color: 'rgb(255, 0, 0)' });

    expect([...root!.children]).toEqual([firstElement, secondElement]);

    act(() => {
      children.next([second, first]);
    });

    expect([...root!.children]).toEqual([secondElement, firstElement]);

    view.rerender(
      <RootReconciler className="updated-root" style={{ color: 'blue' }}>
        {children}
      </RootReconciler>,
    );

    expect(view.container.firstElementChild).toBe(root);

    expect(root).toHaveClass('updated-root');

    expect(root).not.toHaveClass('initial-root');

    expect(root).toHaveStyle({ color: 'rgb(0, 0, 255)' });

    view.unmount();

    expect(children.closed).toBe(false);
  });
});
