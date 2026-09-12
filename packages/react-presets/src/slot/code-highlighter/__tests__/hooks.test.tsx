import type { ThemedToken } from 'shiki/core';

import { act, renderHook, waitFor } from '@testing-library/react';

import { useHighlighted } from '../renderer/hooks';
import { highlightCode as highlightCodeImplementation } from '../renderer/utils';

jest.mock('../renderer/utils', () => ({ highlightCode: jest.fn() }));

const highlightCode = jest.mocked(highlightCodeImplementation);

interface PendingHighlight {
  resolve: (tokens: ThemedToken[][]) => void;

  signal?: AbortSignal;
}

beforeEach(() => {
  highlightCode.mockReset();
});

describe('useHighlighted', () => {
  test('cancels obsolete work and ignores results that resolve after the latest code', async () => {
    const pending = new Map<string, PendingHighlight>();

    highlightCode.mockImplementation(
      (code: string, _language: string, signal?: AbortSignal) =>
        new Promise<ThemedToken[][]>((resolve) => {
          pending.set(code, { resolve, signal });
        }),
    );

    const { result, rerender } = renderHook(({ code }) => useHighlighted(code, 'js'), {
      initialProps: { code: 'before' },
    });

    await waitFor(() => expect(pending.has('before')).toBe(true));
    rerender({ code: 'after' });
    await waitFor(() => expect(pending.has('after')).toBe(true));

    expect(pending.get('before')?.signal?.aborted).toBe(true);

    const currentTokens = [[{ content: 'after', offset: 0 }]];

    await act(async () => pending.get('after')?.resolve(currentTokens));

    expect(result.current).toBe(currentTokens);

    await act(async () => pending.get('before')?.resolve([[{ content: 'before', offset: 0 }]]));

    expect(result.current).toBe(currentTokens);
  });

  test('keeps plaintext available when highlighting fails', async () => {
    highlightCode.mockRejectedValue(new Error('Language chunk unavailable'));

    const { result } = renderHook(() => useHighlighted('source', 'js'));

    await waitFor(() => expect(highlightCode).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });
});
