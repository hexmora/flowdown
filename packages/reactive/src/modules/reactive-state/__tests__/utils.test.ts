import { assert } from '@flowdown/utils';
import { BehaviorSubject, Observable, type Observer, Subscription } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { BatchScheduler } from '../../batch-scheduler';
import { IReactiveState, ReactiveState } from '../index';
import {
  combineMapState,
  combineState,
  isReactiveStateLike,
  mapState,
  toReactiveState,
  toState,
} from '../utils';

const assertType = <T>(_value: T) => undefined;

describe('isReactiveStateLike', () => {
  test('returns true for ReactiveState instances', () => {
    expect(isReactiveStateLike(new ReactiveState({ initial: 1 }))).toBe(true);
  });

  test('returns true for compatible reactive state implementations', () => {
    const state: IReactiveState<number> = {
      value: 1,
      closed: false,
      subscribe: () => new Subscription(),
    };

    expect(isReactiveStateLike<number>(state)).toBe(true);

    if (isReactiveStateLike<number>(state)) {
      assertType<number>(state.value);
    }
  });
});

describe('toReactiveState', () => {
  test('converts an Observable with an explicit current value', () => {
    const observerRef: {
      current: Observer<number> | null;
    } = {
      current: null,
    };
    const source = new Observable<number>((subscriber) => {
      observerRef.current = subscriber;
    });
    const state = toReactiveState(source, 10);
    const next = vi.fn();

    state.subscribe(next);
    const observer = observerRef.current;
    assert(observer);

    observer.next(12);

    expect(next).toHaveBeenNthCalledWith(1, 10);
    expect(next).toHaveBeenNthCalledWith(2, 12);
    expect(state.value).toBe(12);
  });

  test('converts a BehaviorSubject from its current value', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);
    const next = vi.fn();

    state.subscribe(next);
    source.next(3);

    expect(next).toHaveBeenNthCalledWith(1, 1);
    expect(next).toHaveBeenNthCalledWith(2, 3);
    expect(state.value).toBe(3);
  });

  test('closes the converted state when a BehaviorSubject completes', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);

    expect(state.closed).toBe(false);

    source.complete();

    expect(state.closed).toBe(true);
  });

  test('preserves the current value when converting a completed BehaviorSubject', () => {
    const source = new BehaviorSubject(1);
    source.next(2);
    source.complete();

    const state = toReactiveState(source);
    const next = vi.fn();
    const complete = vi.fn();
    const subscription = state.subscribe({ next, complete });

    expect(state.value).toBe(2);
    expect(next).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
  });

  test('uses a BehaviorSubject distinctor without treating it as a current value', () => {
    const source = new BehaviorSubject({ count: 1 });
    const state = toReactiveState(source, (from, to) => from.count === to.count);
    const next = vi.fn();

    state.subscribe(next);
    next.mockClear();
    source.next({ count: 1 });
    source.next({ count: 2 });

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith({ count: 2 });
    expect(state.value).toEqual({ count: 2 });
  });
});

describe('mapState', () => {
  test('maps a direct value as a completed state', () => {
    const mapper = vi.fn((value: number) => value * 2);

    const mapped = mapState(2, mapper);

    expect(mapped.value).toBe(4);

    expect(mapped.closed).toBe(true);

    expect(mapper).toHaveBeenCalledOnce();
  });

  test('provides the previous source and mapped result without rebuilding the initial value', () => {
    interface MappedValue {
      source: number;
      previous: MappedValue | null;
    }

    const source = new BehaviorSubject(1);
    const mapper = vi.fn(
      (value: number, prev: [number, MappedValue] | null): MappedValue => ({
        source: value,
        previous: prev?.[1] ?? null,
      }),
    );
    const mapped = mapState(source, mapper);
    const initialResult = mapper.mock.results[0]?.value;

    expect(mapper).toHaveBeenCalledOnce();
    expect(initialResult).toEqual({ source: 1, previous: null });

    const subscribedResult = mapped.value;

    expect(mapper).toHaveBeenCalledTimes(2);
    expect(subscribedResult.previous).toBe(initialResult);

    source.next(2);

    expect(mapper).toHaveBeenCalledTimes(3);
    expect(mapped.value).toEqual({ source: 2, previous: subscribedResult });
  });

  test('maps values and forwards completion', () => {
    const source = new BehaviorSubject(1);
    const mapped = mapState(source, (value) => value * 10);
    const next = vi.fn();
    const complete = vi.fn();

    const subscription = mapped.subscribe({ next, complete });
    source.next(2);
    source.complete();

    expect(next).toHaveBeenNthCalledWith(1, 10);
    expect(next).toHaveBeenNthCalledWith(2, 20);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
    expect(mapped.closed).toBe(true);
  });

  test('releases its subscription without destroying the source', () => {
    const source = new BehaviorSubject(1);
    const mapped = mapState(source, (value) => value * 10);

    mapped.subscribe({});

    expect(source.observed).toBe(true);

    mapped.destroy();

    expect(source.observed).toBe(false);
    expect(source.closed).toBe(false);
    expect(source.isStopped).toBe(false);
  });
});

describe('combineMapState', () => {
  test('maps direct values as a completed state', () => {
    const mapper = vi.fn(([left, right]: [number, number]) => left + right);

    const mapped = combineMapState([2, 3], mapper);

    expect(mapped.value).toBe(5);

    expect(mapped.closed).toBe(true);

    expect(mapper).toHaveBeenCalledOnce();
  });

  test('infers the mapped state type for heterogeneous sources', () => {
    const sourceA = toReactiveState(new BehaviorSubject(1));
    const sourceB = toReactiveState(new BehaviorSubject('x'));
    const sourceC = toReactiveState(new BehaviorSubject(true));
    const mapped = combineMapState([sourceA, sourceB, sourceC], ([valueA, valueB, valueC]) => ({
      valueA,
      valueB,
      valueC,
    }));

    assertType<IReactiveState<{ valueA: number; valueB: string; valueC: boolean }>>(mapped);
  });

  test('combines latest values and maps source updates', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    const sourceC = new BehaviorSubject(false);
    const mapped = combineMapState(
      [sourceA, sourceB, sourceC],
      ([valueA, valueB, valueC]) => `${valueA}:${valueB}:${valueC}`,
    );
    const next = vi.fn();

    mapped.subscribe(next);

    sourceA.next(2);
    sourceA.next(3);
    sourceB.next('b2');
    sourceC.next(true);

    expect(next.mock.calls).toEqual([
      ['1:b1:false'],
      ['2:b1:false'],
      ['3:b1:false'],
      ['3:b2:false'],
      ['3:b2:true'],
    ]);
  });

  test('does not emit stale mapped values when combining mapped states', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);
    const mappedA = mapState(state, (value) => value * 10);
    const mappedB = mapState(mappedA, (value) => value * 10);
    const mapped = combineMapState(
      [state, mappedA, mappedB],
      ([value, valueA, valueB]) => `${value}:${valueA}:${valueB}`,
    );
    const next = vi.fn();

    mapped.subscribe(next);
    next.mockClear();
    source.next(2);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith('2:20:200');
  });

  test('completes only after every source completes', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b');
    const mapped = combineMapState([sourceA, sourceB], ([valueA, valueB]) => {
      return `${valueA}:${valueB}`;
    });
    const complete = vi.fn();

    mapped.subscribe({ complete });

    sourceA.complete();
    expect(complete).not.toHaveBeenCalled();
    expect(mapped.closed).toBe(false);

    sourceB.complete();
    expect(complete).toHaveBeenCalledOnce();
    expect(mapped.closed).toBe(true);
  });

  test('releases source subscriptions without closing external sources', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b');
    const mapped = combineMapState([sourceA, sourceB], ([valueA, valueB]) => {
      return `${valueA}:${valueB}`;
    });
    const complete = vi.fn();

    mapped.subscribe({ complete });

    expect(sourceA.observed).toBe(true);
    expect(sourceB.observed).toBe(true);

    mapped.destroy();
    mapped.destroy();

    expect(complete).toHaveBeenCalledOnce();
    expect(sourceA.observed).toBe(false);
    expect(sourceB.observed).toBe(false);
    expect(sourceA.closed).toBe(false);
    expect(sourceB.closed).toBe(false);
    expect(sourceA.isStopped).toBe(false);
    expect(sourceB.isStopped).toBe(false);
  });

  test('does not retain sources when destroyed before setup', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b');
    const mapped = combineMapState([sourceA, sourceB], ([valueA, valueB]) => {
      return `${valueA}:${valueB}`;
    });

    expect(sourceA.observed).toBe(false);
    expect(sourceB.observed).toBe(false);

    mapped.destroy();

    expect(sourceA.observed).toBe(false);
    expect(sourceB.observed).toBe(false);
    expect(sourceA.closed).toBe(false);
    expect(sourceB.closed).toBe(false);
  });
});

describe('combineState', () => {
  test('combines direct values as a completed tuple state', () => {
    const combined = combineState(1, 'value', true);

    expect(combined.value).toEqual([1, 'value', true]);

    expect(combined.closed).toBe(true);
  });

  test('combines direct and reactive values', () => {
    const source = new BehaviorSubject(1);

    const combined = combineState('value', source);

    const next = vi.fn();

    const complete = vi.fn();

    combined.subscribe({ next, complete });

    source.next(2);

    expect(next).toHaveBeenLastCalledWith(['value', 2]);

    source.complete();

    expect(complete).toHaveBeenCalledOnce();

    expect(combined.closed).toBe(true);
  });

  test('infers a strict tuple type for heterogeneous sources', () => {
    const sourceA = toReactiveState(new BehaviorSubject(1));
    const sourceB = toReactiveState(new BehaviorSubject('x'));
    const sourceC = toReactiveState(new BehaviorSubject(true));
    const combined = combineState(sourceA, sourceB, sourceC);

    assertType<IReactiveState<[number, string, boolean]>>(combined);
  });

  test('preserves a NaN source priority', () => {
    const source = new ReactiveState({ initial: 1 });

    BatchScheduler.setPriority(source, NaN);

    expect(BatchScheduler.getPriority(combineState(source))).toBeNaN();
  });

  test('combines latest values and re-emits on source updates', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    const sourceC = new BehaviorSubject(false);
    const combined = combineState(sourceA, sourceB, sourceC);
    const next = vi.fn();

    combined.subscribe(next);

    sourceA.next(2);
    sourceA.next(3);
    sourceB.next('b2');
    sourceC.next(true);

    expect(next.mock.calls).toEqual([
      [[1, 'b1', false]],
      [[2, 'b1', false]],
      [[3, 'b1', false]],
      [[3, 'b2', false]],
      [[3, 'b2', true]],
    ]);
  });

  test('does not emit stale tuples when combining mapped states', () => {
    const source = new BehaviorSubject(1);
    const state = toReactiveState(source);
    const mappedA = mapState(state, (value) => value * 10);
    const mappedB = mapState(mappedA, (value) => value * 10);
    const combined = combineState(state, mappedA, mappedB);
    const next = vi.fn();

    combined.subscribe(next);
    next.mockClear();
    source.next(2);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith([2, 20, 200]);
  });

  test('treats completed rxjs BehaviorSubjects as stopped sources', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    const combined = combineState(sourceA, sourceB);
    const complete = vi.fn();

    const subscription = combined.subscribe({ complete });
    sourceA.complete();

    expect(sourceA.closed).toBe(false);
    expect(sourceA.isStopped).toBe(true);
    expect(complete).toHaveBeenCalledTimes(0);

    sourceB.complete();

    expect(complete).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
    expect(combined.closed).toBe(true);
  });

  test('closes when every source completes', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    const combined = combineState(sourceA, sourceB);

    expect(combined.closed).toBe(false);

    sourceA.complete();
    expect(combined.closed).toBe(false);

    sourceB.complete();
    expect(combined.closed).toBe(true);
  });

  test('releases sibling subscriptions when a source errors', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    const combined = combineState(sourceA, sourceB);
    const error = vi.fn();

    combined.subscribe({ error });
    sourceA.error(new Error('failed'));

    expect(error).toHaveBeenCalledOnce();
    expect(sourceB.observed).toBe(false);
    expect(combined.closed).toBe(true);
  });

  test('completes immediately when all rxjs BehaviorSubjects were already completed', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    sourceA.complete();
    sourceB.complete();

    const combined = combineState(sourceA, sourceB);
    const complete = vi.fn();
    const subscription = combined.subscribe({ complete });

    expect(combined.value).toEqual([1, 'b1']);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(subscription.closed).toBe(true);
    expect(combined.closed).toBe(true);
  });

  test('forwards source errors', () => {
    const sourceA = new BehaviorSubject(1);
    const sourceB = new BehaviorSubject('b1');
    const combined = combineState(sourceA, sourceB);
    const sourceError = new Error('boom');
    const error = vi.fn();

    combined.subscribe({ error });
    sourceA.error(sourceError);

    expect(error).toHaveBeenCalledWith(sourceError);
    expect(combined.closed).toBe(true);
  });

  test('forwards the first source error within a batch', () => {
    const sourceA = new BehaviorSubject(1);

    const sourceB = new BehaviorSubject('b1');

    const combined = combineState(sourceA, sourceB);

    const firstError = new Error('first');

    const error = vi.fn();

    combined.subscribe({ error });

    BatchScheduler.batch(() => {
      sourceA.error(firstError);

      sourceB.error(new Error('second'));
    });

    expect(error).toHaveBeenCalledOnce();

    expect(error).toHaveBeenCalledWith(firstError);
  });
});

describe('toState', () => {
  test('preserves state sources and wraps direct values', () => {
    const source = ReactiveState.of(1);

    const direct = toState(2);

    expect(toState(source)).toBe(source);

    expect(direct.value).toBe(2);

    expect(direct.closed).toBe(true);
  });
});
