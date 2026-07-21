import type { Observer } from 'rxjs';

import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { ReactiveState } from '../../reactive-state';

import { MutableState } from '..';
import { BatchScheduler } from '../../batch-scheduler';

describe('MutableState', () => {
  test('returns a shared readonly reactive state view', () => {
    const state = MutableState.of(0);
    const readonlyState = state.toReadonly();
    const next = vi.fn();

    expectTypeOf(readonlyState).toEqualTypeOf<ReactiveState<number>>();
    expect(readonlyState).toBe(state);

    readonlyState.subscribe(next);
    state.next(1);

    expect(readonlyState.value).toBe(1);
    expect(next.mock.calls).toEqual([[0], [1]]);
  });

  test('stays open and accepts external updates without an emitter', () => {
    const state = MutableState.of(0);
    const next = vi.fn();

    state.subscribe(next);
    state.next(1);
    state.next(2);

    expect(state.value).toBe(2);
    expect(state.closed).toBe(false);
    expect(next.mock.calls).toEqual([[0], [1], [2]]);
  });

  test('allows external updates between emitter updates', () => {
    const observerRef: { current: Observer<number> | null } = { current: null };
    const emitter = vi.fn((observer: Observer<number>) => {
      observerRef.current = observer;
      observer.next(1);
    });
    const state = new MutableState({ initial: 0, emitter });
    const next = vi.fn();

    state.subscribe(next);
    state.next(10);
    observerRef.current?.next(2);

    expect(emitter).toHaveBeenCalledOnce();
    expect(next.mock.calls).toEqual([[1], [10], [2]]);
    expect(state.value).toBe(2);
  });

  test('sets up a lazy emitter when next is called externally', () => {
    const emitter = vi.fn();
    const state = new MutableState({ initial: 0, emitter });

    expect(emitter).not.toHaveBeenCalled();

    state.next(1);
    state.next(2);

    expect(emitter).toHaveBeenCalledOnce();
    expect(state.value).toBe(2);
  });

  test('applies the distinctor to external updates', () => {
    const state = new MutableState({
      initial: { count: 0 },
      distinctor: (from, to) => from.count === to.count,
    });
    const next = vi.fn();

    state.subscribe(next);
    next.mockClear();
    state.next({ count: 0 });
    state.next({ count: 1 });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith({ count: 1 });
    expect(state.value).toEqual({ count: 1 });
  });

  test('completes externally and tears down the emitter', () => {
    const teardown = vi.fn();
    const state = new MutableState({
      initial: 0,
      emitter: () => teardown,
    });
    const next = vi.fn();
    const complete = vi.fn();

    state.subscribe({ next, complete });
    next.mockClear();
    state.complete();
    state.next(1);

    expect(complete).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    expect(state.closed).toBe(true);
  });

  test('errors externally and tears down the emitter', () => {
    const expectedError = new Error('mutable state failed');
    const teardown = vi.fn();
    const state = new MutableState({
      initial: 0,
      emitter: () => teardown,
    });
    const error = vi.fn();

    state.subscribe({ error });
    state.error(expectedError);
    state.next(1);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(expectedError);
    expect(teardown).toHaveBeenCalledOnce();
    expect(state.closed).toBe(true);
  });

  test('coalesces updates in a batch', () => {
    const state = MutableState.of(0);
    const next = vi.fn();

    state.subscribe(next);
    next.mockClear();

    BatchScheduler.batch(() => {
      state.next(1);
      state.next(2);

      expect(state.value).toBe(2);
      expect(next).not.toHaveBeenCalled();
    });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(2);
  });

  test('publishes the pending value before completing a batch', () => {
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
  });

  test('publishes the pending value before erroring a batch', () => {
    const state = MutableState.of(0);
    const expectedError = new Error('mutable state failed');
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
      state.error(expectedError);
    });

    expect(events).toEqual([1, expectedError]);
    expect(state.closed).toBe(true);
  });
});
