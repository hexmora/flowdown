import { BaseSmoothScheduler, BaseSmoothTicker } from '@flowdown/core-presets/mapper';

export class StepSmoothScheduler extends BaseSmoothScheduler {
  static instances: StepSmoothScheduler[] = [];

  protected readonly defaultTuple = [1];

  readonly startCalls: {
    timestamp: number;

    index: number;
  }[] = [];

  private cursor = 0;

  constructor() {
    super();

    StepSmoothScheduler.instances.push(this);
  }

  override reset(index = 0) {
    super.reset(index);

    this.cursor = index;
  }

  start(timestamp: number, index = 0) {
    this.startCalls.push({ timestamp, index });

    this.reset(index);
  }

  tick(_timestamp: number) {
    const [step = 1] = this.tuple;

    const distance = Math.min(step, this.fullIndex - this.cursor);

    this.cursor += distance;

    return distance;
  }
}

export class DoubleStepSmoothScheduler extends StepSmoothScheduler {
  static override instances: DoubleStepSmoothScheduler[] = [];

  protected override readonly defaultTuple = [2];

  constructor() {
    super();

    DoubleStepSmoothScheduler.instances.push(this);
  }
}

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

  override destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyCalls += 1;

    super.destroy();
  }
}
