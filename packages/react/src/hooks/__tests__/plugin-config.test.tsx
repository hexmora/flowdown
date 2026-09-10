import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { combineState, mapClosure } from 'reactive';
import { describe, expect, test, vi } from 'vitest';

import { usePluginConfig } from '..';

describe('usePluginConfig', () => {
  test('keeps shared fields alive when a mapper creates its replacement before releasing itself', async () => {
    const { result, rerender, unmount } = renderHook((config) => usePluginConfig(config), {
      initialProps: { count: 1 },
    });

    const fields = result.current;

    const previous = mapClosure(fields.count, (count) => count);

    expect(previous.value.value).toBe(1);

    const replacement = mapClosure(fields.count, (count) => count);

    expect(replacement.value.value).toBe(1);

    previous.destroy();

    expect(fields.count.value.closed).toBe(false);

    rerender({ count: 2 });

    expect(result.current).toBe(fields);

    expect(replacement.value.value).toBe(2);

    unmount();

    await act(async () => {});

    expect(fields.count.value.closed).toBe(true);

    expect(replacement.value.closed).toBe(true);

    replacement.destroy();
  });

  test('keeps field identities and updates one consistent snapshot through StrictMode', async () => {
    const { result, rerender, unmount } = renderHook((config) => usePluginConfig(config), {
      initialProps: { ticker: 'first', scheduler: 'slow' },
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });

    const fields = result.current;

    const combined = combineState(fields.ticker, fields.scheduler);

    const next = vi.fn();

    combined.subscribe(next);

    next.mockClear();

    rerender({ ticker: 'second', scheduler: 'fast' });

    expect(result.current).toBe(fields);

    expect(next).toHaveBeenCalledExactlyOnceWith(['second', 'fast']);

    expect(fields.ticker.value.closed).toBe(false);

    expect(fields.scheduler.value.closed).toBe(false);

    unmount();

    await act(async () => {});

    expect(fields.ticker.value.closed).toBe(true);

    expect(fields.scheduler.value.closed).toBe(true);

    expect(combined.closed).toBe(true);

    combined.destroy();
  });
});
