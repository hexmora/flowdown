import { vi } from 'vitest';

import { BaseSmoothTicker } from '..';

export class FakeSmoothTicker extends BaseSmoothTicker {
  destroyCalls = 0;

  private active = false;

  private timestamp: number;

  constructor(timestamp = 0) {
    super();

    this.timestamp = timestamp;
  }

  override get running() {
    return this.active;
  }

  start() {
    if (this.active) {
      throw new Error('Cannot start a running ticker');
    }

    this.active = true;

    return this.timestamp;
  }

  stop() {
    if (!this.active) {
      throw new Error('Cannot stop a stopping ticker');
    }

    this.active = false;
  }

  tick(timestamp: number) {
    if (!this.active) {
      throw new Error('Cannot tick a stopping ticker');
    }

    if (timestamp < this.timestamp) {
      throw new Error('Cannot tick previous timestamp');
    }

    this.timestamp = timestamp;

    this.subject.next(timestamp);
  }

  advanceTo(timestamp: number) {
    if (this.active) {
      throw new Error('Cannot advance a running ticker');
    }

    if (timestamp < this.timestamp) {
      throw new Error('Cannot advance to previous timestamp');
    }

    this.timestamp = timestamp;
  }

  override destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyCalls += 1;

    super.destroy();
  }
}

export const mockAnimationFrames = () => {
  const callbacks = new Map<number, (timestamp: number) => void>();

  let nextId = 0;

  const request = vi.fn((callback: (timestamp: number) => void) => {
    const id = ++nextId;

    callbacks.set(id, callback);

    return id;
  });

  const cancel = vi.fn((id: number) => callbacks.delete(id));

  const frame = (id: number) => {
    const callback = callbacks.get(id);

    if (!callback) {
      throw new Error(`Expected frame ${id}.`);
    }

    return callback;
  };

  vi.stubGlobal('requestAnimationFrame', request);

  vi.stubGlobal('cancelAnimationFrame', cancel);

  return { cancel, frame, request };
};
