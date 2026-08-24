import { MutableState } from '@flowdown/reactive';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { useStateOf, useStateValue } from '..';

interface ComparableValue {
  id: number;
  label: string;
}

const equalById = (left: ComparableValue, right: ComparableValue) => left.id === right.id;

const strictWrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);

describe('useStateOf', () => {
  test('exposes a changed prop through state.value during that same render', () => {
    const valuesReadDuringRender: string[] = [];

    const Harness = ({ value }: { value: string }) => {
      const state = useStateOf(value);

      valuesReadDuringRender.push(state.value);

      return <output aria-label="state value">{state.value}</output>;
    };

    const view = render(<Harness value="alpha" />);

    expect(screen.getByRole('status', { name: 'state value' })).toHaveTextContent('alpha');

    view.rerender(<Harness value="beta" />);

    expect(screen.getByRole('status', { name: 'state value' })).toHaveTextContent('beta');

    expect(valuesReadDuringRender[valuesReadDuringRender.length - 1]).toBe('beta');
  });

  test('keeps one reactive state while forwarding changed React values', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useStateOf(value),
      { initialProps: { value: 'alpha' } },
    );

    const state = result.current;

    const observer = vi.fn();

    const subscription = state.subscribe(observer);

    expect(state.value).toBe('alpha');

    expect(observer).toHaveBeenLastCalledWith('alpha');

    act(() => {
      rerender({ value: 'beta' });
    });

    expect(result.current).toBe(state);

    expect(state.value).toBe('beta');

    expect(observer).toHaveBeenLastCalledWith('beta');

    subscription.unsubscribe();

    unmount();

    await waitFor(() => {
      expect(state.closed).toBe(true);
    });
  });

  test('uses the comparer to retain the previous value and suppress equal updates', () => {
    const initial: ComparableValue = { id: 1, label: 'initial' };

    const { result, rerender } = renderHook(
      ({ value }: { value: ComparableValue }) => useStateOf(value, equalById),
      { initialProps: { value: initial } },
    );

    const state = result.current;

    const observer = vi.fn();

    const subscription = state.subscribe(observer);

    act(() => {
      rerender({ value: { id: 1, label: 'equal but new' } });
    });

    expect(result.current).toBe(state);

    expect(state.value).toBe(initial);

    expect(observer).toHaveBeenCalledTimes(1);

    const changed: ComparableValue = { id: 2, label: 'changed' };

    act(() => {
      rerender({ value: changed });
    });

    expect(state.value).toBe(changed);

    expect(observer).toHaveBeenCalledTimes(2);

    expect(observer).toHaveBeenLastCalledWith(changed);

    subscription.unsubscribe();
  });

  test('stays usable across StrictMode effect replay and closes after the real unmount', async () => {
    const { result, rerender, unmount } = renderHook(
      ({ value }: { value: string }) => useStateOf(value),
      {
        initialProps: { value: 'strict-alpha' },
        wrapper: strictWrapper,
      },
    );

    const state = result.current;

    expect(state.closed).toBe(false);

    act(() => {
      rerender({ value: 'strict-beta' });
    });

    expect(result.current).toBe(state);

    expect(state.closed).toBe(false);

    expect(state.value).toBe('strict-beta');

    unmount();

    await waitFor(() => {
      expect(state.closed).toBe(true);
    });
  });
});

describe('useStateValue', () => {
  test('renders an external state update synchronously within act', () => {
    const state = MutableState.of('before');

    const Harness = () => <output aria-label="external value">{useStateValue(state)}</output>;

    const view = render(<Harness />);

    expect(screen.getByRole('status', { name: 'external value' })).toHaveTextContent('before');

    act(() => {
      state.next('after');
    });

    expect(screen.getByRole('status', { name: 'external value' })).toHaveTextContent('after');

    view.unmount();

    expect(state.closed).toBe(false);
  });
});
