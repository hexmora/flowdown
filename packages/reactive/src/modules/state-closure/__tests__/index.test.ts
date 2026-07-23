import { BehaviorSubject, Subscription } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import { BaseStateClosure, type BaseStateClosureParams } from '..';
import { BatchScheduler } from '../../batch-scheduler';
import { MutableState } from '../../mutable-state';
import {
  combineMapState,
  type IReactiveState,
  mapState,
  type StateSubscriber,
  toReactiveState,
} from '../../reactive-state';

class WritableBaseStateClosure<T> extends BaseStateClosure<T> {
  write(value: T) {
    this.next(value);
  }
}

const emitToSubscriber = <T>(subscriber: StateSubscriber<T>, value: T) => {
  if (typeof subscriber === 'function') {
    subscriber(value);

    return;
  }

  subscriber.next?.(value);
};

const createTrackedReactiveSource = <T>(initial: T) => {
  let current = initial;
  let subscriber: StateSubscriber<T> | null = null;

  const unsubscribe = vi.fn(() => {
    subscriber = null;
  });
  const subscribe = vi.fn((nextSubscriber: StateSubscriber<T>) => {
    subscriber = nextSubscriber;

    return new Subscription(unsubscribe);
  });
  const source: IReactiveState<T> = {
    get value() {
      return current;
    },
    closed: false,
    subscribe,
  };

  return {
    emit: (value: T) => {
      current = value;

      if (subscriber) {
        emitToSubscriber(subscriber, value);
      }
    },
    source: source as BaseStateClosureParams<T>['source'],
    subscribe,
    unsubscribe,
  };
};

describe('BaseStateClosure', () => {
  test('supports inherited static initial values and next updates', () => {
    const closure = new WritableBaseStateClosure({ source: 1 });
    const next = vi.fn();

    closure.value.subscribe(next);
    next.mockClear();

    closure.write(2);

    expect(closure.value.value).toBe(2);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(2);
  });

  test('temporarily overrides inherited reactive state values until the source updates again', () => {
    const sourceSubject = new BehaviorSubject(1);
    const source = toReactiveState(sourceSubject);
    const closure = new WritableBaseStateClosure({ source });
    const next = vi.fn();

    closure.value.subscribe(next);
    next.mockClear();

    closure.write(2);

    expect(source.value).toBe(1);
    expect(closure.value.value).toBe(2);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(2);

    next.mockClear();
    sourceSubject.next(3);

    expect(source.value).toBe(3);
    expect(closure.value.value).toBe(3);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(3);
  });

  test('updates directly constructed closures from BehaviorSubject and reactive state sources', () => {
    const subjectSource = new BehaviorSubject(1);
    const subjectClosure = new BaseStateClosure({ source: subjectSource });
    const subjectNext = vi.fn();
    const stateSourceSubject = new BehaviorSubject('a');
    const stateSource = toReactiveState(stateSourceSubject);
    const stateClosure = new BaseStateClosure({ source: stateSource });
    const stateNext = vi.fn();

    subjectClosure.value.subscribe(subjectNext);
    stateClosure.value.subscribe(stateNext);
    subjectNext.mockClear();
    stateNext.mockClear();

    subjectSource.next(2);
    stateSourceSubject.next('b');

    expect(subjectClosure.value.value).toBe(2);
    expect(subjectNext).toHaveBeenCalledOnce();
    expect(subjectNext).toHaveBeenCalledWith(2);
    expect(stateClosure.value.value).toBe('b');
    expect(stateNext).toHaveBeenCalledOnce();
    expect(stateNext).toHaveBeenCalledWith('b');
  });

  test('cleans up source and value subscriptions on destroy', () => {
    const source = createTrackedReactiveSource(1);
    const closure = new BaseStateClosure({ source: source.source });
    const next = vi.fn();
    const complete = vi.fn();
    const subscription = closure.value.subscribe({ next, complete });

    next.mockClear();
    closure.destroy();
    source.emit(2);

    expect(source.unsubscribe).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(subscription.closed).toBe(true);
    expect(closure.value.closed).toBe(true);
    expect(closure.value.value).toBe(1);
    expect(next).toHaveBeenCalledTimes(0);
  });

  test('closes an obtained value even when the value was never set up', () => {
    const source = createTrackedReactiveSource(1);
    const closure = new BaseStateClosure({ source: source.source });
    const value = closure.value;

    closure.destroy();

    expect(source.unsubscribe).toHaveBeenCalledOnce();
    expect(value.closed).toBe(true);
  });

  test('defers setup until value access by default', () => {
    const source = createTrackedReactiveSource(1);
    const closure = new BaseStateClosure({ source: source.source });

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    source.emit(2);

    expect(source.subscribe).toHaveBeenCalledTimes(0);
    expect(closure.value.value).toBe(2);
    expect(source.subscribe).toHaveBeenCalledOnce();
  });

  test('cannot initialize after being destroyed while still lazy', () => {
    const sourceFactory = vi.fn(() => 1);
    const closure = new BaseStateClosure({ source: sourceFactory });

    closure.destroy();

    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');
    expect(sourceFactory).not.toHaveBeenCalled();
  });

  test('sets up immediately when lazy is false', () => {
    const source = createTrackedReactiveSource(1);
    const closure = new BaseStateClosure({ source: source.source, lazy: false });

    expect(source.subscribe).toHaveBeenCalledOnce();

    source.emit(2);

    expect(closure.value.value).toBe(2);
  });

  test('sets up lazily when inherited next is called before value access', () => {
    const source = createTrackedReactiveSource(1);
    const closure = new WritableBaseStateClosure({ source: source.source });

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    closure.write(2);

    expect(source.subscribe).toHaveBeenCalledOnce();
    expect(closure.value.value).toBe(2);
  });

  test('resolves function sources lazily and reuses the setup result', () => {
    let current = 1;
    const sourceFactory = vi.fn(() => current);
    const closure = new BaseStateClosure({ source: sourceFactory });

    current = 2;

    expect(sourceFactory).toHaveBeenCalledTimes(0);
    expect(closure.value.value).toBe(2);
    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(closure.value.value).toBe(2);
    expect(sourceFactory).toHaveBeenCalledOnce();
  });

  test('sets up function sources immediately when lazy is false', () => {
    const sourceFactory = vi.fn(() => 1);
    const closure = new BaseStateClosure({ source: sourceFactory, lazy: false });

    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(closure.value.value).toBe(1);
    expect(sourceFactory).toHaveBeenCalledOnce();
  });

  test('updates from BehaviorSubject sources returned by functions', () => {
    const source = new BehaviorSubject(1);
    const sourceFactory = vi.fn(() => source);
    const closure = new BaseStateClosure({ source: sourceFactory });
    const next = vi.fn();

    source.next(2);

    expect(sourceFactory).toHaveBeenCalledTimes(0);
    closure.value.subscribe(next);
    next.mockClear();

    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(closure.value.value).toBe(2);
    expect(sourceFactory).toHaveBeenCalledOnce();

    source.next(3);

    expect(closure.value.value).toBe(3);
    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(3);
  });

  test('updates from ReactiveState sources returned by functions', () => {
    const sourceSubject = new BehaviorSubject(1);
    const source = toReactiveState(sourceSubject);
    const sourceFactory = vi.fn(() => source);
    const closure = new BaseStateClosure({ source: sourceFactory });
    const next = vi.fn();

    sourceSubject.next(2);

    expect(sourceFactory).toHaveBeenCalledTimes(0);
    closure.value.subscribe(next);
    next.mockClear();

    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(closure.value.value).toBe(2);
    expect(sourceFactory).toHaveBeenCalledOnce();

    sourceSubject.next(3);

    expect(closure.value.value).toBe(3);
    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(3);
  });

  test('cleans up subscriptions created from function sources on destroy', () => {
    const source = new BehaviorSubject(1);
    const sourceFactory = vi.fn(() => source);
    const closure = new BaseStateClosure({ source: sourceFactory });
    const next = vi.fn();
    const complete = vi.fn();
    const subscription = closure.value.subscribe({ next, complete });

    next.mockClear();
    closure.destroy();
    source.next(2);

    expect(sourceFactory).toHaveBeenCalledOnce();
    expect(complete).toHaveBeenCalledOnce();
    expect(subscription.closed).toBe(true);
    expect(closure.value.closed).toBe(true);
    expect(closure.value.value).toBe(1);
    expect(next).toHaveBeenCalledTimes(0);
  });

  test('preserves scheduler priority through an unequal diamond dependency', () => {
    const source = MutableState.of(1);
    const short = mapState(source, (value) => value * 10);
    const longHead = mapState(source, (value) => value + 1);
    const longSource = mapState(longHead, (value) => value * 100);
    const closure = new BaseStateClosure({ source: longSource });
    const joinMapper = vi.fn(
      ([shortValue, longValue]: [number, number]) => `${shortValue}:${longValue}`,
    );
    const joined = combineMapState([short, closure.value], joinMapper);
    const next = vi.fn();

    joined.subscribe(next);
    joinMapper.mockClear();
    next.mockClear();

    expect(BatchScheduler.getPriority(closure.value)).toBe(
      BatchScheduler.getPriority(longSource) + 1,
    );

    source.next(2);

    expect(joinMapper).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith('20:300');

    joined.destroy();
    closure.destroy();
    short.destroy();
    longSource.destroy();
    longHead.destroy();
    source.destroy();
  });

  test('releases its subscription without destroying the source', () => {
    const source = new BehaviorSubject(1);
    const closure = new BaseStateClosure({ source });

    closure.value.subscribe({});

    expect(source.observed).toBe(true);

    closure.destroy();

    expect(source.observed).toBe(false);
    expect(source.closed).toBe(false);
    expect(source.isStopped).toBe(false);
  });
});
