import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { useStatic } from '..';

describe('useStatic', () => {
  test('creates one value for the lifetime of the mounted hook', () => {
    let createdCount = 0;

    const { result, rerender } = renderHook(
      ({ label }: { label: string }) =>
        useStatic(() => ({
          id: ++createdCount,
          label,
        })),
      { initialProps: { label: 'first' } },
    );

    const initial = result.current;

    rerender({ label: 'second' });

    expect(result.current).toBe(initial);
    expect(result.current).toEqual({ id: 1, label: 'first' });
    expect(createdCount).toBe(1);
  });
});
