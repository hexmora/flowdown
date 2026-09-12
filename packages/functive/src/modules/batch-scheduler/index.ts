import { isFunction, isObject, isUndefined } from 'lodash-es';

type BatchRunner<T> = () => T;

type BatchUpdate = () => void;

// oxlint-disable-next-line typescript/no-extraneous-class -- The class is the scheduler API.
export class BatchScheduler {
  private constructor() {}

  private static readonly priorities = /*#__PURE__*/ new WeakMap<object, number | (() => number)>();

  private static priorityCache: Map<object, number> | null = null;

  private static readonly pendingUpdates = /*#__PURE__*/ new Map<unknown, BatchUpdate>();

  private static depth = 0;

  private static flushing = false;

  static batch<T>(runner: BatchRunner<T>): T {
    this.depth += 1;

    try {
      return runner();
    } finally {
      this.depth -= 1;

      this.flush();
    }
  }

  static schedule(update: BatchUpdate, handler: unknown = update) {
    this.pendingUpdates.set(handler, update);

    this.flush();
  }

  /**
   * Assigns a priority or resolves it from current dependencies when selecting queued work.
   */
  static setPriority(handler: unknown, priority: number | (() => number)) {
    if (!isObject(handler)) {
      throw new TypeError('Batch scheduler handlers must be objects or functions.');
    }

    this.priorities.set(handler, priority);
  }

  static getPriority(handler: unknown) {
    if (!isObject(handler)) {
      return 0;
    }

    const previousCache = this.priorityCache;

    const cache = (this.priorityCache ??= new Map());

    try {
      const cached = cache.get(handler);

      if (!isUndefined(cached)) {
        return cached;
      }

      const priority = this.priorities.get(handler) ?? 0;

      const resolved = isFunction(priority) ? priority() : priority;

      cache.set(handler, resolved);

      return resolved;
    } finally {
      this.priorityCache = previousCache;
    }
  }

  private static takeNextUpdate(): BatchUpdate | null {
    let nextEntry: [unknown, BatchUpdate] | null = null;

    let nextPriority = 0;

    for (const entry of this.pendingUpdates) {
      const priority = this.getPriority(entry[0]);

      if (!nextEntry || priority < nextPriority) {
        nextEntry = entry;

        nextPriority = priority;
      }
    }

    if (!nextEntry) {
      return null;
    }

    this.pendingUpdates.delete(nextEntry[0]);

    return nextEntry[1];
  }

  private static flush() {
    if (this.depth > 0 || this.flushing) {
      return;
    }

    const errors: unknown[] = [];

    this.flushing = true;

    try {
      while (this.pendingUpdates.size > 0) {
        const update = this.takeNextUpdate();

        try {
          update?.();
        } catch (error) {
          errors.push(error);
        }
      }
    } finally {
      this.flushing = false;
    }

    if (errors.length > 0) {
      throw errors[0];
    }
  }
}
