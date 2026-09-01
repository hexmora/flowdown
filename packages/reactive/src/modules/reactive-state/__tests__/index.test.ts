import { BehaviorSubject, type Observer } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { ReactiveState } from '..';
import { toReactiveState } from '../../../helpers/operator';
import { assert } from '../../../utils';
import { BatchScheduler } from '../../batch-scheduler';

describe('ReactiveState', () => {
  test('defers emitter setup until value access by default', () => {
    const emitter = vi.fn((observer: Observer<number>) => {
      observer.next(1);
    });

    const state = new ReactiveState({ initial: 0, emitter });

    expect(emitter).toHaveBeenCalledTimes(0);
    expect(state.value).toBe(1);
    expect(emitter).toHaveBeenCalledOnce();
    expect(state.value).toBe(1);
    expect(emitter).toHaveBeenCalledOnce();
  });

  test('runs emitter immediately when lazy is false', () => {
    const emitter = vi.fn((observer: Observer<number>) => {
      observer.next(1);
    });

    const state = new ReactiveState({ initial: 0, emitter, lazy: false });
    const next = vi.fn();

    expect(emitter).toHaveBeenCalledTimes(1);
    expect(state.value).toBe(1);

    state.subscribe(next);

    expect(state.value).toBe(1);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(1);
  });

  test('sets up a lazy emitter when value state is accessed', () => {
    const emitter = vi.fn((observer: Observer<number>) => {
      observer.complete();
    });
    const state = new ReactiveState({ initial: 0, emitter });

    expect(emitter).toHaveBeenCalledTimes(0);
    expect(state.closed).toBe(true);
    expect(emitter).toHaveBeenCalledOnce();
  });

  test('runs a synchronous lazy emitter only once', () => {
    const emitter = vi.fn((observer: Observer<number>) => {
      observer.next(1);
      observer.next(2);
    });
    const state = new ReactiveState({ initial: 0, emitter });

    expect(state.value).toBe(2);
    expect(emitter).toHaveBeenCalledOnce();
  });

  test('without emitter completes immediately and keeps the initial value silent', () => {
    const state = new ReactiveState({ initial: 7 });
    const next = vi.fn();
    const complete = vi.fn();

    const subscription = state.subscribe({ next, complete });

    expect(state.value).toBe(7);
    expect(next).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
    expect(state.closed).toBe(true);
  });

  test('creates a completed state with a fixed value', () => {
    const state = ReactiveState.of(7);
    const next = vi.fn();
    const complete = vi.fn();

    const subscription = state.subscribe({ next, complete });

    expect(state.value).toBe(7);
    expect(next).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledOnce();
    expect(subscription.closed).toBe(true);
    expect(state.closed).toBe(true);
  });

  test('uses the distinctor to suppress equal state updates', () => {
    const observerRef: {
      current: Observer<{ count: number }> | null;
    } = {
      current: null,
    };
    const state = new ReactiveState({
      initial: { count: 0 },
      emitter: (nextObserver) => {
        observerRef.current = nextObserver;
      },
      distinctor: (from, to) => from.count === to.count,
    });
    const next = vi.fn();

    state.subscribe(next);
    next.mockClear();

    const observer = observerRef.current;
    assert(observer);

    observer.next({ count: 0 });
    expect(next).toHaveBeenCalledTimes(0);
    expect(state.value).toEqual({ count: 0 });

    observer.next({ count: 1 });
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith({ count: 1 });
    expect(state.value).toEqual({ count: 1 });
  });

  test('uses Object.is as the default distinctor', () => {
    const observerRef: {
      current: Observer<number> | null;
    } = {
      current: null,
    };

    const state = new ReactiveState({
      initial: 0,
      emitter: (currentObserver) => {
        observerRef.current = currentObserver;
      },
    });

    const next = vi.fn();

    state.subscribe(next);

    next.mockClear();

    const observer = observerRef.current;

    assert(observer);

    observer.next(-0);

    expect(next).toHaveBeenCalledOnce();

    expect(Object.is(state.value, -0)).toBe(true);

    observer.next(-0);

    expect(next).toHaveBeenCalledOnce();

    state.destroy();
  });

  test('does not duplicate the current value after an rxjs source reconnects', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);
    const firstNext = vi.fn();

    const firstSubscription = state.subscribe(firstNext);
    firstSubscription.unsubscribe();
    source.next(2);

    const secondNext = vi.fn();
    const secondSubscription = state.subscribe(secondNext);

    expect(secondNext).toHaveBeenCalledOnce();
    expect(secondNext).toHaveBeenCalledWith(2);
    expect(state.value).toBe(2);

    secondSubscription.unsubscribe();
  });

  test('completes when the rxjs source completes', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);
    const complete = vi.fn();

    const subscription = state.subscribe({ complete });
    source.complete();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
    expect(state.closed).toBe(true);
  });

  test('destroys the emitter and observers immediately and idempotently', () => {
    const teardown = vi.fn();
    const state = new ReactiveState({
      initial: 1,
      emitter: () => teardown,
    });
    const complete = vi.fn();

    state.subscribe({ complete });
    state.destroy();
    state.destroy();

    expect(teardown).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(state.closed).toBe(true);
  });

  test('suppresses a pending update when destroyed inside a batch', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);
    const next = vi.fn();
    const complete = vi.fn();

    state.subscribe({ next, complete });
    next.mockClear();

    BatchScheduler.batch(() => {
      source.next(2);
      state.destroy();
    });

    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
    expect(state.value).toBe(1);
    expect(source.closed).toBe(false);
    expect(source.isStopped).toBe(false);
  });

  test('keeps completion private while exposing deterministic destruction', () => {
    const state = new ReactiveState({ initial: 1 });

    expect(state).toHaveProperty('destroy');
    expect(state).not.toHaveProperty('complete');
  });
});
