import { act } from '@testing-library/react';
import { expect, vi } from 'vitest';

export const createRafClock = () => {
  const pending = new Map<number, FrameRequestCallback>();

  let nextId = 0;

  let timestamp = 0;

  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = ++nextId;

    pending.set(id, callback);

    return id;
  });

  const cancel = vi.fn((id: number) => {
    pending.delete(id);
  });

  vi.spyOn(performance, 'now').mockImplementation(() => timestamp);

  vi.stubGlobal('requestAnimationFrame', request);

  vi.stubGlobal('cancelAnimationFrame', cancel);

  const step = async () => {
    timestamp += 16;

    const frame = [...pending];

    pending.clear();

    await act(async () => {
      for (const [, callback] of frame) {
        callback(timestamp);
      }
    });
  };

  const advanceUntil = async (complete: () => boolean) => {
    for (let frame = 0; frame < 700 && !complete(); frame += 1) {
      // Each frame must commit its DOM changes before the completion check.
      // oxlint-disable-next-line no-await-in-loop
      await step();
    }

    expect(complete()).toBe(true);
  };

  return { advanceUntil, cancel, pending, request, step };
};
