import { last } from 'lodash-es';

import {
  DoubleStepSmoothScheduler,
  StepSmoothScheduler,
} from '../modules/scheduler/__tests__/utils';
import { FakeSmoothTicker } from '../modules/ticker/__tests__/utils';

export class PrimarySmoothTicker extends FakeSmoothTicker {
  static instances: PrimarySmoothTicker[] = [];

  constructor() {
    super();

    PrimarySmoothTicker.instances.push(this);
  }
}

export class SecondarySmoothTicker extends FakeSmoothTicker {
  static instances: SecondarySmoothTicker[] = [];

  constructor() {
    super();

    SecondarySmoothTicker.instances.push(this);
  }
}

export const resetSmoothTests = () => {
  PrimarySmoothTicker.instances = [];

  SecondarySmoothTicker.instances = [];

  StepSmoothScheduler.instances = [];

  DoubleStepSmoothScheduler.instances = [];
};

export const observerCount = (state: object) => {
  return (state as { subject: { observers: unknown[] } }).subject.observers.length;
};

export const latest = <T>(instances: T[]): T => {
  const instance = last(instances);

  if (!instance) {
    throw new Error('Expected a constructed test instance.');
  }

  return instance;
};
