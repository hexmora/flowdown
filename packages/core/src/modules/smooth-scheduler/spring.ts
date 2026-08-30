import { BaseSmoothScheduler } from './base';

const MINIMUM_OBSERVABLE_SPEED = 0.5 / 1000;

export class SpringSmoothScheduler extends BaseSmoothScheduler {
  static readonly name = 'spring';

  protected readonly defaultTuple = [20, 15, 1 / 700 / 1000, 2, 10 ** 5 + 1];

  private timestamp = 0;

  private speed = 0;

  private fraction = 0;

  private currentIndex: number;

  private targetIndex: number;

  private started = false;

  constructor(tuple?: number[]) {
    super(tuple);

    this.currentIndex = this.fullIndex;

    this.targetIndex = 0;
  }

  override reset(index = 0) {
    const [initialSpeed] = this.tuple;

    super.reset(index);

    this.currentIndex = index;

    this.targetIndex = 0;

    this.speed = initialSpeed / 1000;
  }

  start(timestamp: number, index = 0) {
    this.reset(index);

    this.timestamp = timestamp;

    this.started = true;
  }

  tick(timestamp: number) {
    if (!this.started) {
      throw new Error('Cannot tick without call start');
    }

    const elapsed = Math.max(0, timestamp - this.timestamp);

    this.timestamp = Math.max(this.timestamp, timestamp);

    if (elapsed === 0) {
      return 0;
    }

    const [, desiredBuffer, springRatio, minimumSpeed, maximumSpeed] = this.tuple;

    this.targetIndex = Math.max(this.targetIndex, desiredBuffer, this.fullIndex - desiredBuffer);

    if (this.currentIndex >= this.fullIndex) {
      this.currentIndex = this.fullIndex;

      this.speed = Math.max(minimumSpeed / 1000, this.speed * 0.9);

      if (this.speed < MINIMUM_OBSERVABLE_SPEED) {
        this.speed = 0;
      }

      return 0;
    }

    this.speed = Math.min(
      maximumSpeed / 1000,
      Math.max(0, this.speed + (this.targetIndex - this.currentIndex) * springRatio * elapsed),
    );

    if (this.speed < MINIMUM_OBSERVABLE_SPEED) {
      this.speed = 0;

      return 0;
    }

    const previousIndex = this.currentIndex;

    this.currentIndex = Math.min(this.fullIndex, this.currentIndex + this.speed * elapsed);

    const availableDistance = this.currentIndex - previousIndex + this.fraction;

    const distance = Math.floor(availableDistance);

    this.fraction = availableDistance - distance;

    return Math.max(0, distance);
  }
}
