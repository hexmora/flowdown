import { BaseSmoothTicker } from './base';
import { getNow } from './utils';

export class IntervalSmoothTicker extends BaseSmoothTicker {
  static readonly name = 'interval';

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly interval = 1000 / 60) {
    super();
  }

  start() {
    if (this.running) {
      throw new Error('Cannot start a running ticker');
    }

    const timestamp = getNow();

    this.runningState = true;

    this.timer = setInterval(() => {
      if (this.running) {
        this.subject.next(getNow());
      }
    }, this.interval);

    return timestamp;
  }

  stop() {
    if (!this.running) {
      throw new Error('Cannot stop a stopping ticker');
    }

    this.runningState = false;

    if (this.timer !== null) {
      clearInterval(this.timer);

      this.timer = null;
    }
  }
}
