import { BaseSmoothScheduler } from '..';

export class TargetScheduler extends BaseSmoothScheduler {
  protected readonly defaultTuple = [1, 2];

  start(_timestamp: number, index = 0) {
    this.reset(index);
  }

  tick(_timestamp: number) {
    return this.fullIndex;
  }
}

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
