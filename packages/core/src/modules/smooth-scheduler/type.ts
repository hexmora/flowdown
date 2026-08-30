export interface IScheduler {
  /**
   * Effective scheduler parameter tuple.
   */
  readonly tuple: number[];

  /**
   * Adds available visible content units to the target index.
   */
  push(length: number): void;

  /**
   * Replaces the target index.
   * @default index 0
   */
  reset(index?: number): void;

  /**
   * Starts timing from an index.
   * @default index 0
   */
  start(timestamp: number, index?: number): void;

  /**
   * Advances timing and returns the next visible content-unit distance.
   */
  tick(timestamp: number): number;
}
