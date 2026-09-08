import type { IScheduler } from './type';

export abstract class BaseSmoothScheduler implements IScheduler {
  protected abstract readonly defaultTuple: number[];

  protected fullIndex = 0;

  constructor(private readonly configuredTuple?: number[]) {}

  get tuple() {
    const tuple = this.configuredTuple ?? this.defaultTuple;

    if (tuple.length !== this.defaultTuple.length) {
      throw new Error(`Expected a scheduler tuple with ${this.defaultTuple.length} values`);
    }

    return tuple;
  }

  push(length: number) {
    this.fullIndex += length;
  }

  reset(index = 0) {
    this.fullIndex = index;
  }

  abstract start(timestamp: number, index?: number): void;

  abstract tick(timestamp: number): number;
}
