import { assert } from '@fluxdown/utils';

import { BaseSmoothTicker } from './base';
import { getNow } from './utils';

export class IntervalSmoothTicker extends BaseSmoothTicker {
  static readonly name = 'interval';

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly interval = 1000 / 60) {
    super();
  }

  get running() {
    return this.timer !== null;
  }

  start() {
    assert(!this.destroyed, 'Cannot start a destroyed ticker');

    assert(!this.running, 'Cannot start a running ticker');

    const timestamp = getNow();

    this.timer = setInterval(() => this.subject.next(getNow()), this.interval);

    return timestamp;
  }

  stop() {
    assert(this.timer !== null, 'Cannot stop a stopping ticker');

    clearInterval(this.timer);

    this.timer = null;
  }
}
