import { MutableState } from '@flowdown/reactive';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { useStateOf, useStateValue } from '..';

interface ComparableValue {
  id: number;
  label: string;
}

interface SelectorProps {
  distinctor: typeof equalById;

  key: 'first' | 'second';
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

  test('uses a comparer without a selector', () => {
    const initial = { id: 1, label: 'initial' };

    const state = MutableState.of(initial);

    const { result } = renderHook(() => useStateValue(state, equalById));

    act(() => {
      state.next({ id: 1, label: 'equal but new' });
    });

    expect(result.current).toBe(initial);

    act(() => {
      state.next({ id: 2, label: 'changed' });
    });

    expect(result.current).toEqual({ id: 2, label: 'changed' });
  });

  test('retains an equal selection', () => {
    const initialSelection = { id: 1, label: 'initial' };

    const state = MutableState.of({ ignored: 0, selected: initialSelection });

    const { result } = renderHook(() => useStateValue(state, (value) => value.selected, equalById));

    act(() => {
      state.next({ ignored: 1, selected: { id: 1, label: 'equal but new' } });
    });

    expect(result.current).toBe(initialSelection);

    act(() => {
      state.next({ ignored: 2, selected: { id: 2, label: 'changed' } });
    });

    expect(result.current).toEqual({ id: 2, label: 'changed' });
  });

  test('uses changed selectors and comparers without resubscribing to stale closures', () => {
    const state = MutableState.of({
      first: { id: 1, label: 'first' },
      second: { id: 1, label: 'second' },
    });
    const initialProps: SelectorProps = { key: 'first', distinctor: equalById };

    const { result, rerender } = renderHook(
      ({ key, distinctor }: SelectorProps) =>
        useStateValue(state, (value) => value[key], distinctor),
      { initialProps },
    );

    expect(result.current.label).toBe('first');

    rerender({ key: 'second', distinctor: () => false });

    expect(result.current.label).toBe('second');

    act(() => {
      state.next({
        first: { id: 1, label: 'first updated' },
        second: { id: 1, label: 'second updated' },
      });
    });

    expect(result.current.label).toBe('second updated');
  });

  test('provides the selected snapshot during server rendering', () => {
    const state = MutableState.of({ value: 'server selection' });

    const Harness = () => <output>{useStateValue(state, (current) => current.value)}</output>;

    expect(renderToString(<Harness />)).toContain('server selection');
  });

  test('recognizes a boolean selector as a selector', () => {
    const state = MutableState.of({ enabled: true });

    const { result } = renderHook(() => useStateValue(state, (current) => current.enabled));

    expect(result.current).toBe(true);
  });
});
