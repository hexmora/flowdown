import { describe, expect, test, vi } from 'vitest';

import { BatchScheduler } from '..';

describe('BatchScheduler', () => {
  test('runs lower priorities first and coalesces updates by handler', () => {
    const firstHandler = {};
    const secondHandler = {};
    const calls: string[] = [];

    BatchScheduler.setPriority(firstHandler, 1);
    BatchScheduler.setPriority(secondHandler, 2);

    BatchScheduler.batch(() => {
      BatchScheduler.schedule(() => {
        calls.push('second:stale');
      }, secondHandler);
      BatchScheduler.schedule(() => {
        calls.push('first');
      }, firstHandler);
      BatchScheduler.schedule(() => {
        calls.push('second:final');
      }, secondHandler);
    });

    expect(BatchScheduler.getPriority(firstHandler)).toBe(1);
    expect(BatchScheduler.getPriority(secondHandler)).toBe(2);
    expect(calls).toEqual(['first', 'second:final']);
  });

  test('uses the update as the default handler', () => {
    const update = vi.fn();

    BatchScheduler.batch(() => {
      BatchScheduler.schedule(update);
      BatchScheduler.schedule(update);
    });

    expect(update).toHaveBeenCalledOnce();
  });
});
