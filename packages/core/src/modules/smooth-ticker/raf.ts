import { BaseSmoothTicker } from './base';
import { getNow } from './utils';

export class RafSmoothTicker extends BaseSmoothTicker {
  static readonly name = 'raf';

  private frame: number | null = null;

  private generation = 0;

  private scheduleFrame(generation: number) {
    this.frame = requestAnimationFrame((timestamp) => {
      this.onFrame(timestamp, generation);
    });
  }

  private onFrame(timestamp: number, generation: number) {
    if (!this.running || generation !== this.generation) {
      return;
    }

    this.frame = null;

    this.subject.next(timestamp);

    if (this.running && generation === this.generation) {
      this.scheduleFrame(generation);
    }
  }

  start() {
    if (this.running) {
      throw new Error('Cannot start a running ticker');
    }

    const timestamp = getNow();

    this.runningState = true;

    this.generation += 1;

    this.scheduleFrame(this.generation);

    return timestamp;
  }

  stop() {
    if (!this.running) {
      throw new Error('Cannot stop a stopping ticker');
    }

    this.runningState = false;

    this.generation += 1;

    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);

      this.frame = null;
    }
  }
}
