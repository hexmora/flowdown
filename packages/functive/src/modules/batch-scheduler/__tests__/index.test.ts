import { BatchScheduler } from '../index';

describe('BatchScheduler', () => {
  test('discards cached priorities after a resolver throws', () => {
    const source = {};

    const failed = {};

    const failure = new Error('Priority failed.');

    let priority = 1;

    BatchScheduler.setPriority(source, () => priority);

    BatchScheduler.setPriority(failed, () => {
      BatchScheduler.getPriority(source);

      throw failure;
    });

    expect(() => BatchScheduler.getPriority(failed)).toThrow(failure);

    priority = 2;

    expect(BatchScheduler.getPriority(source)).toBe(2);
  });

  test('reads shared priority dependencies once without caching later changes', () => {
    let priority = 1;

    const readPriority = jest.fn(() => priority);

    let current = {};

    BatchScheduler.setPriority(current, readPriority);

    for (let depth = 0; depth < 20; depth++) {
      const source = current;

      const left = {};

      const right = {};

      const joined = {};

      BatchScheduler.setPriority(left, () => BatchScheduler.getPriority(source) + 1);

      BatchScheduler.setPriority(right, () => BatchScheduler.getPriority(source) + 1);

      BatchScheduler.setPriority(
        joined,
        () => Math.max(BatchScheduler.getPriority(left), BatchScheduler.getPriority(right)) + 1,
      );

      current = joined;
    }

    expect(BatchScheduler.getPriority(current)).toBe(41);

    expect(readPriority).toHaveBeenCalledTimes(1);

    priority = 2;

    expect(BatchScheduler.getPriority(current)).toBe(42);

    expect(readPriority).toHaveBeenCalledTimes(2);
  });

  test('resolves deferred priorities when selecting queued work', () => {
    const first = {};

    const second = {};

    const calls: string[] = [];

    let priority = 1;

    const readPriority = jest.fn(() => priority);

    BatchScheduler.setPriority(first, readPriority);

    BatchScheduler.setPriority(second, 2);

    expect(readPriority).not.toHaveBeenCalled();

    BatchScheduler.batch(() => {
      BatchScheduler.schedule(() => calls.push('first'), first);

      BatchScheduler.schedule(() => calls.push('second'), second);

      priority = 3;
    });

    expect(calls).toEqual(['second', 'first']);

    expect(BatchScheduler.getPriority(first)).toBe(3);
  });

  test('runs lower priorities first and coalesces updates by handler', () => {
    const firstHandler = {};
    const secondHandler = {};
    const calls: string[] = [];

    BatchScheduler.setPriority(firstHandler, 1);
    BatchScheduler.setPriority(secondHandler, 2);

    BatchScheduler.batch(() => {
      BatchScheduler.schedule(() => {
        calls.push('second:stale');
      }, secondHandler);
      BatchScheduler.schedule(() => {
        calls.push('first');
      }, firstHandler);
      BatchScheduler.schedule(() => {
        calls.push('second:final');
      }, secondHandler);
    });

    expect(BatchScheduler.getPriority(firstHandler)).toBe(1);
    expect(BatchScheduler.getPriority(secondHandler)).toBe(2);
    expect(calls).toEqual(['first', 'second:final']);
  });

  test('uses the update as the default handler', () => {
    const update = jest.fn();

    BatchScheduler.batch(() => {
      BatchScheduler.schedule(update);
      BatchScheduler.schedule(update);
    });

    expect(update).toHaveBeenCalledTimes(1);
  });
});
