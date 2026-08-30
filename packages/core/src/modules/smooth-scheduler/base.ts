import type { IScheduler } from './type';

export abstract class BaseSmoothScheduler implements IScheduler {
  protected abstract readonly defaultTuple: number[];

  private readonly suppliedTuple: number[] | undefined;

  private currentFullIndex: number;

  constructor(tuple?: number[]) {
    this.suppliedTuple = tuple;

    this.currentFullIndex = 0;
  }

  get tuple() {
    if (this.suppliedTuple && this.suppliedTuple.length !== this.defaultTuple.length) {
      throw new Error('Scheduler tuple length must match the default tuple length');
    }

    return this.suppliedTuple ?? this.defaultTuple;
  }

  protected get fullIndex() {
    return this.currentFullIndex;
  }

  push(length: number) {
    this.currentFullIndex += length;
  }

  reset(index = 0) {
    this.currentFullIndex = index;
  }

  abstract start(timestamp: number, index?: number): void;

  abstract tick(timestamp: number): number;
}
