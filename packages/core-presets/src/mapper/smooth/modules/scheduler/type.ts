export interface IScheduler {
  /**
   * Configuration values interpreted by the scheduler implementation.
   */
  readonly tuple: number[];

  /**
   * Add newly available visible units to the target position.
   */
  push(length: number): void;

  /**
   * Reset progress and the target to the supplied absolute position.
   * @default index 0
   */
  reset(index?: number): void;

  /**
   * Start timing at the supplied timestamp and absolute position.
   * @default index 0
   */
  start(timestamp: number, index?: number): void;

  /**
   * Return the nonnegative number of visible units to advance at this timestamp.
   */
  tick(timestamp: number): number;
}
