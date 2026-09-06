import { clamp, isUndefined } from 'lodash-es';

import { BaseSmoothScheduler } from './base';

export class SpringSmoothScheduler extends BaseSmoothScheduler {
  static readonly name = 'spring';

  /**
   * Initial speed, buffer size, elasticity, resume speed, and maximum speed.
   * @default [20, 15, 1 / 700 / 1000, 2, 100_001]
   */
  protected readonly defaultTuple = [20, 15, 1 / 700 / 1000, 2, 100_001];

  private timestamp?: number;

  private position = 0;

  private speed = 0;

  private remainder = 0;

  override reset(index = 0) {
    super.reset(index);

    const [initialSpeed] = this.tuple;

    this.position = index;

    this.speed = initialSpeed / 1000;
  }

  start(timestamp: number, index = 0) {
    this.reset(index);

    this.timestamp = timestamp;
  }

  tick(timestamp: number) {
    if (isUndefined(this.timestamp)) {
      throw new Error('Cannot tick without call start');
    }

    const elapsed = timestamp - this.timestamp;

    if (elapsed <= 0) {
      return 0;
    }

    this.timestamp = timestamp;

    const [, buffer, elasticity, resumeSpeed, maximumSpeed] = this.tuple;

    if (this.position >= this.fullIndex) {
      this.speed = Math.max(this.speed * 0.9, resumeSpeed / 1000);

      return 0;
    }

    const destination = Math.max(buffer, this.fullIndex - buffer);

    this.speed = clamp(
      this.speed + (destination - this.position) * elasticity * elapsed,
      0,
      maximumSpeed / 1000,
    );

    if (this.speed < 0.5 / 1000) {
      this.speed = 0;
    }

    const nextPosition = Math.min(this.fullIndex, this.position + this.speed * elapsed);

    const progress = this.remainder + Math.max(0, nextPosition - this.position);

    const distance = Math.floor(progress);

    this.remainder = progress - distance;

    this.position = nextPosition;

    return distance;
  }
}
