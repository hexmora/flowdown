import { act } from '@testing-library/react';

import { stubGlobal } from '../../../../../scripts/testing/globals';

export const createRafClock = () => {
  const pending = new Map<number, FrameRequestCallback>();

  let nextId = 0;

  let timestamp = 0;

  const request = jest.fn((callback: FrameRequestCallback) => {
    const id = ++nextId;

    pending.set(id, callback);

    return id;
  });

  const cancel = jest.fn((id: number) => {
    pending.delete(id);
  });

  jest.spyOn(performance, 'now').mockImplementation(() => timestamp);

  stubGlobal('requestAnimationFrame', request);

  stubGlobal('cancelAnimationFrame', cancel);

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
