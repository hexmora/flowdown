import { BaseSmoothScheduler, BaseSmoothTicker } from '@flowdown/core-presets/mapper';
import { last } from 'lodash-es';

export const createManualTicker = () => {
  class ManualTicker extends BaseSmoothTicker {
    private active = false;

    destroyCalls = 0;

    constructor() {
      super();

      instances.push(this);
    }

    get running() {
      return this.active;
    }

    start() {
      this.active = true;

      return 0;
    }

    stop() {
      this.active = false;
    }

    tick(timestamp: number) {
      this.subject.next(timestamp);
    }

    override destroy() {
      if (this.destroyed) {
        return;
      }

      this.destroyCalls += 1;

      this.stop();

      super.destroy();
    }
  }

  const instances: ManualTicker[] = [];

  const current = () => {
    const ticker = last(instances);

    if (!ticker) {
      throw new Error('Expected the configured ticker to be constructed.');
    }

    return ticker;
  };

  return { Ticker: ManualTicker, current, instances };
};

export const createStepScheduler = (step: number) => {
  return class StepScheduler extends BaseSmoothScheduler {
    protected readonly defaultTuple = [];

    private cursor = 0;

    override reset(index = 0) {
      super.reset(index);

      this.cursor = index;
    }

    start(_timestamp: number, index = 0) {
      this.reset(index);
    }

    tick(_timestamp: number) {
      const distance = Math.min(step, Math.max(0, this.fullIndex - this.cursor));

      this.cursor += distance;

      return distance;
    }
  };
};
