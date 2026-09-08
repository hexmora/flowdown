import { assert } from '@flowdown/utils';

import { BaseSmoothTicker } from './base';
import { getNow } from './utils';

export class RafSmoothTicker extends BaseSmoothTicker {
  static readonly name = 'raf';

  private frame: number | null = null;

  private generation = 0;

  get running() {
    return this.frame !== null;
  }

  start() {
    assert(!this.destroyed, 'Cannot start a destroyed ticker');

    assert(!this.running, 'Cannot start a running ticker');

    const timestamp = getNow();

    const generation = ++this.generation;

    const next = (time: number) => {
      if (!this.running || generation !== this.generation) {
        return;
      }

      this.subject.next(time);

      if (this.running && generation === this.generation) {
        this.frame = requestAnimationFrame(next);
      }
    };

    this.frame = requestAnimationFrame(next);

    return timestamp;
  }

  stop() {
    assert(this.frame !== null, 'Cannot stop a stopping ticker');

    cancelAnimationFrame(this.frame);

    this.frame = null;

    this.generation += 1;
  }
}
