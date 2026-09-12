import { BatchScheduler } from '../../batch-scheduler';
import { MutableState } from '../../mutable-state';
import { combineMapState, combineState, mapState } from '../exports/operator';

describe('BatchScheduler', () => {
  test('publishes one consistent snapshot for multiple source updates', () => {
    const left = MutableState.of(1);
    const right = MutableState.of(2);
    const combined = combineMapState([left, right], ([leftValue, rightValue]) => ({
      left: leftValue,
      right: rightValue,
    }));
    const combinedNext = jest.fn();
    const rightAtLeftEmission: number[] = [];

    combined.subscribe(combinedNext);
    left.subscribe(() => {
      rightAtLeftEmission.push(right.value);
    });
    combinedNext.mockClear();
    rightAtLeftEmission.splice(0);

    BatchScheduler.batch(() => {
      left.next(10);
      right.next(20);

      expect(left.value).toBe(10);
      expect(right.value).toBe(20);
      expect(combinedNext).not.toHaveBeenCalled();
    });

    expect(combinedNext).toHaveBeenCalledTimes(1);
    expect(combinedNext).toHaveBeenCalledWith({ left: 10, right: 20 });
    expect(rightAtLeftEmission).toEqual([20]);

    combinedNext.mockClear();

    BatchScheduler.batch(() => {
      right.next(30);
      left.next(40);
    });

    expect(combinedNext).toHaveBeenCalledTimes(1);
    expect(combinedNext).toHaveBeenCalledWith({ left: 40, right: 30 });
  });

  test('settles unequal diamond dependencies before publishing their join', () => {
    const source = MutableState.of(1);
    const short = mapState(source, (value) => value * 10);
    const longHead = mapState(source, (value) => value + 1);
    const long = mapState(longHead, (value) => value * 100);
    const joinMapper = jest.fn(
      ([shortValue, longValue]: [number, number]) => `${shortValue}:${longValue}`,
    );
    const joined = combineMapState([short, long], joinMapper);
    const next = jest.fn();

    joined.subscribe(next);
    joinMapper.mockClear();
    next.mockClear();

    source.next(2);

    expect(joinMapper).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith('20:300');
  });

  test('supports nesting and coalesces repeated writes', () => {
    const state = MutableState.of(0);
    const next = jest.fn();

    state.subscribe(next);
    next.mockClear();

    BatchScheduler.batch(() => {
      state.next(1);

      BatchScheduler.batch(() => {
        state.next(2);
        state.next(3);
      });

      expect(next).not.toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(3);
  });

  test('suppresses a batch whose final value equals its initial value', () => {
    const state = MutableState.of(0);
    const next = jest.fn();

    state.subscribe(next);
    next.mockClear();

    BatchScheduler.batch(() => {
      state.next(1);
      state.next(0);
    });

    expect(state.value).toBe(0);
    expect(next).not.toHaveBeenCalled();
  });

  test('flushes pending updates when the runner throws', () => {
    const state = MutableState.of(0);
    const next = jest.fn();

    state.subscribe(next);
    next.mockClear();

    expect(() => {
      BatchScheduler.batch(() => {
        state.next(1);
        throw new Error('failed');
      });
    }).toThrow('failed');

    expect(state.value).toBe(1);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(1);
  });

  test('publishes a pending value before completing', () => {
    const state = MutableState.of(0);
    const events: string[] = [];

    state.subscribe({
      next: (value) => {
        events.push(`next:${value}`);
      },
      complete: () => {
        events.push('complete');
      },
    });
    events.splice(0);

    BatchScheduler.batch(() => {
      state.next(1);
      state.complete();
      state.next(2);

      expect(state.value).toBe(1);
      expect(state.closed).toBe(true);
      expect(events).toEqual([]);
    });

    expect(events).toEqual(['next:1', 'complete']);
    expect(state.closed).toBe(true);
  });

  test('ignores writes requested after a pending completion', () => {
    const state = MutableState.of(0);
    const events: string[] = [];

    state.subscribe({
      next: (value) => {
        events.push(`next:${value}`);
      },
      complete: () => {
        events.push('complete');
      },
    });
    events.splice(0);

    BatchScheduler.batch(() => {
      state.complete();
      state.next(1);
    });

    expect(events).toEqual(['complete']);
    expect(state.value).toBe(0);
  });

  test('publishes a pending value before forwarding an error', () => {
    const state = MutableState.of(0);
    const sourceError = new Error('failed');
    const events: Array<number | Error> = [];

    state.subscribe({
      next: (value) => {
        events.push(value);
      },
      error: (error) => {
        events.push(error as Error);
      },
    });
    events.splice(0);

    BatchScheduler.batch(() => {
      state.next(1);
      state.error(sourceError);
    });

    expect(events).toEqual([1, sourceError]);
    expect(state.closed).toBe(true);
  });

  test('forwards an error instead of completing from pending terminal state', () => {
    const left = MutableState.of(1);
    const right = MutableState.of(2);
    const combined = combineState(left, right);
    const sourceError = new Error('failed');
    const complete = jest.fn();
    const error = jest.fn();

    combined.subscribe({ complete, error });

    BatchScheduler.batch(() => {
      left.complete();
      right.error(sourceError);
    });

    expect(complete).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(sourceError);
  });

  test('commits reentrant writes before their requested completion', () => {
    const state = MutableState.of(0);
    const values: number[] = [];
    const complete = jest.fn();

    state.subscribe({
      next: (value) => {
        values.push(value);

        if (value === 1) {
          state.next(2);
          state.complete();
        }
      },
      complete,
    });

    state.next(1);

    expect(values).toEqual([0, 1, 2]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  test('still terminates when a pending value comparison throws', () => {
    const comparisonError = new Error('comparison failed');
    const distinctor = jest.fn(() => {
      if (distinctor.mock.calls.length === 2) {
        throw comparisonError;
      }

      return false;
    });
    const state = new MutableState({ initial: 0, distinctor });
    const complete = jest.fn();

    state.subscribe({ complete });

    expect(() => {
      BatchScheduler.batch(() => {
        state.next(1);
        state.complete();
      });
    }).toThrow(comparisonError);

    expect(complete).toHaveBeenCalledTimes(1);
    expect(state.closed).toBe(true);
  });
});
