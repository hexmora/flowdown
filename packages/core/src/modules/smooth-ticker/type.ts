import type { Observable } from 'rxjs';

export interface ITicker {
  /**
   * Whether timestamp updates are active.
   */
  readonly running: boolean;

  /**
   * Monotonic timestamp updates.
   */
  readonly value: Observable<number>;

  /**
   * Starts updates and returns the current monotonic timestamp.
   */
  start(): number;

  /**
   * Stops timestamp updates.
   */
  stop(): void;

  /**
   * Stops updates and completes the timestamp stream.
   */
  destroy(): void;
}
