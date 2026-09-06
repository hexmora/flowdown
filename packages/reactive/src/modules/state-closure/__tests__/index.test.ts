import { isFunction } from 'lodash-es';
import { BehaviorSubject, Subscription } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import type { IReactiveState, StateSubscriber } from '../../reactive-state';

import { BatchScheduler } from '../../batch-scheduler';
import { MutableState } from '../../mutable-state';
import { combineMapState, mapState, ReactiveState, toReactiveState } from '../../reactive-state';
import { D, render as renderDescriptor, S, type StateClosureResult } from '../exports/render';
import {
  BaseStateClosure,
  combineMapClosure,
  FactoryReadableClosure,
  type IReadableClosure,
  mapClosure,
  mapEachClosure,
  type StateClosureSource,
  toClosure,
} from '../index';

type SourceInputs<T> = {
  source: StateClosureSource<T>;
};

class Source<T> extends BaseStateClosure<T, SourceInputs<T>> {
  protected render() {
    const { source } = this.inputs;

    return toClosure(source);
  }
}

class WritableSource<T> extends Source<T> {
  write(value: T) {
    this.next(value);
  }
}

class NumberSource extends BaseStateClosure<number> {
  protected render() {
    return ReactiveState.of(7);
  }
}

type InputSourceInputs = {
  source: IReadableClosure<number>;
};

class InputSource extends BaseStateClosure<number, InputSourceInputs> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

type FactorySourceInputs<T> = {
  source: () => StateClosureSource<T>;
};

class FactorySource<T> extends BaseStateClosure<T, FactorySourceInputs<T>> {
  constructor(source: () => StateClosureSource<T>) {
    super({ source });
  }

  readonly render = vi.fn((): StateClosureResult<T> => {
    const { source } = this.inputs;

    return toClosure(source());
  });
}

const doubleValue = (value: number) => value * 2;

const emitToSubscriber = <T>(subscriber: StateSubscriber<T>, value: T) => {
  if (isFunction(subscriber)) {
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
    source,
    subscribe,
    unsubscribe,
  };
};

describe('BaseStateClosure runtime', () => {
  test.each([
    { name: 'direct', create: (source: MutableState<number>) => toClosure(source) },

    { name: 'nested', create: (source: MutableState<number>) => new Source({ source }) },
  ])('reads pending values when a $name closure is initialized inside a batch', ({ create }) => {
    const source = MutableState.of(1);

    const closure = create(source);

    BatchScheduler.batch(() => {
      source.next(2);

      expect(closure.value.value).toBe(2);
    });

    expect(closure.value.value).toBe(2);

    closure.destroy();

    source.destroy();
  });

  test('preserves pending values before completion during first access', () => {
    const source = MutableState.of(1);

    const closure = toClosure(source);

    const complete = vi.fn();

    BatchScheduler.batch(() => {
      source.next(2);

      source.complete();

      closure.value.subscribe({ complete });

      expect(closure.value.value).toBe(2);

      expect(complete).not.toHaveBeenCalled();
    });

    expect(closure.value.value).toBe(2);

    expect(complete).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('preserves pending values before an error during first access', () => {
    const source = MutableState.of(1);

    const closure = toClosure(source);

    const error = vi.fn();

    const failure = new Error('Failed after the pending value.');

    BatchScheduler.batch(() => {
      source.next(2);

      source.error(failure);

      closure.value.subscribe({ error });

      expect(closure.value.value).toBe(2);

      expect(error).not.toHaveBeenCalled();
    });

    expect(error).toHaveBeenCalledExactlyOnceWith(failure);

    expect(() => closure.value.value).toThrow(failure);

    closure.destroy();
  });

  test('keeps synchronous source advances made during subscription', () => {
    let current = 1;

    const source: IReactiveState<number> = {
      get value() {
        return current;
      },

      closed: false,

      subscribe(subscriber) {
        current = 2;

        emitToSubscriber(subscriber, current);

        return new Subscription();
      },
    };

    const closure = toClosure(source);

    expect(closure.value.value).toBe(2);

    closure.destroy();
  });

  test('preserves later event payloads when a source advances reentrantly', () => {
    const source = new BehaviorSubject(0);

    source.subscribe((value) => {
      if (value === 1) {
        source.next(2);
      }
    });

    const closure = toClosure(source);

    const next = vi.fn();

    closure.value.subscribe(next);

    source.next(1);

    expect(next.mock.calls).toEqual([[0], [2], [1]]);

    closure.destroy();

    source.complete();
  });

  test('supports inherited initial values and next updates', () => {
    const closure = new WritableSource({ source: new BehaviorSubject(1) });

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

    const closure = new WritableSource({ source });

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

    const subjectClosure = new Source({ source: subjectSource });

    const subjectNext = vi.fn();

    const stateSourceSubject = new BehaviorSubject('a');

    const stateSource = toReactiveState(stateSourceSubject);

    const stateClosure = new Source({ source: stateSource });

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

    const closure = new Source({ source: source.source });

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

  test('closes an obtained value when destroyed', () => {
    const source = createTrackedReactiveSource(1);

    const closure = new Source({ source: source.source });

    const value = closure.value;

    closure.destroy();

    expect(source.unsubscribe).toHaveBeenCalledOnce();

    expect(value.closed).toBe(true);
  });

  test('defers setup until value access', () => {
    const source = createTrackedReactiveSource(1);

    const closure = new Source({ source: source.source });

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    source.emit(2);

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    expect(closure.value.value).toBe(2);

    expect(source.subscribe).toHaveBeenCalledOnce();
  });

  test('cannot initialize after being destroyed while still lazy', () => {
    const sourceFactory = vi.fn(() => 1);

    const closure = new FactorySource(sourceFactory);

    closure.destroy();

    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');

    expect(sourceFactory).not.toHaveBeenCalled();
  });

  test('sets up lazily when inherited next is called before value access', () => {
    const source = createTrackedReactiveSource(1);

    const closure = new WritableSource({ source: source.source });

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    closure.write(2);

    expect(source.subscribe).toHaveBeenCalledOnce();

    expect(closure.value.value).toBe(2);
  });

  test('invokes render callbacks lazily and reuses the setup result', () => {
    let current = 1;

    const sourceFactory = vi.fn(() => current);

    const closure = new FactorySource(sourceFactory);

    current = 2;

    expect(sourceFactory).toHaveBeenCalledTimes(0);

    expect(closure.value.value).toBe(2);

    expect(sourceFactory).toHaveBeenCalledOnce();

    expect(closure.value.value).toBe(2);

    expect(sourceFactory).toHaveBeenCalledOnce();
  });

  test('does not invoke callable reactive states returned by render', () => {
    const source = new BehaviorSubject(1);

    const callableSource = Object.assign(
      vi.fn(() => 999),
      {
        closed: false,
        subscribe: source.subscribe.bind(source),
        value: source.value,
      },
    ) as IReactiveState<number> & (() => number);

    const closure = new Source<number>({ source: callableSource });

    expect(closure.value.value).toBe(1);

    expect(callableSource).not.toHaveBeenCalled();

    source.next(2);

    expect(closure.value.value).toBe(2);

    expect(callableSource).not.toHaveBeenCalled();

    closure.destroy();

    source.complete();
  });

  test('preserves function values returned by render', () => {
    const value = vi.fn(() => 42);

    const closure = new Source<typeof value>({ source: value });

    expect(closure.value.value).toBe(value);

    expect(value).not.toHaveBeenCalled();

    closure.destroy();
  });

  test('updates from BehaviorSubject values returned by render', () => {
    const source = new BehaviorSubject(1);

    const sourceFactory = vi.fn(() => source);

    const closure = new FactorySource(sourceFactory);

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

  test('updates from ReactiveState values returned by render', () => {
    const sourceSubject = new BehaviorSubject(1);

    const source = toReactiveState(sourceSubject);

    const sourceFactory = vi.fn(() => source);

    const closure = new FactorySource(sourceFactory);

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

  test('cleans up subscriptions created from render values on destroy', () => {
    const source = new BehaviorSubject(1);

    const sourceFactory = vi.fn(() => source);

    const closure = new FactorySource(sourceFactory);

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

  test.each([
    { name: 'direct', create: (source: IReadableClosure<number>) => source },

    {
      name: 'descriptor',

      create: (source: IReadableClosure<number>) => {
        return renderDescriptor(S([InputSource, { source }]));
      },
    },
  ])('exposes $name closure priorities without initializing lazy state flows', ({ create }) => {
    const build = vi.fn(() => ReactiveState.of(1));

    const closure = create(FactoryReadableClosure.create(build));

    expect(BatchScheduler.getPriority(closure)).toBe(0);

    expect(build).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(1);

    expect(BatchScheduler.getPriority(closure)).toBe(BatchScheduler.getPriority(closure.value));

    expect(BatchScheduler.getPriority(closure)).toBeGreaterThan(0);

    expect(build).toHaveBeenCalledOnce();

    closure.destroy();

    expect(() => BatchScheduler.getPriority(closure)).not.toThrow();

    const unopened = create(FactoryReadableClosure.create(build));

    unopened.destroy();

    expect(BatchScheduler.getPriority(unopened)).toBe(0);

    expect(build).toHaveBeenCalledOnce();
  });

  test('follows new dependency depth through a closure priority alias', () => {
    const source = MutableState.of([0]);

    const value = MutableState.of(2);

    const child = mapClosure(mapClosure(value, doubleValue), doubleValue);

    const closure = mapEachClosure(source, (_item, index) => {
      return index === 0 ? ReactiveState.of(0) : child;
    });

    expect(closure.value.value).toEqual([0]);

    const initial = BatchScheduler.getPriority(closure);

    source.next([0, 1]);

    expect(closure.value.value).toEqual([0, 8]);

    expect(BatchScheduler.getPriority(closure)).toBeGreaterThan(initial);

    expect(BatchScheduler.getPriority(closure)).toBe(BatchScheduler.getPriority(closure.value));

    BatchScheduler.setPriority(value, 20);

    expect(BatchScheduler.getPriority(closure)).toBeGreaterThan(20);

    closure.destroy();

    expect(() => BatchScheduler.getPriority(closure)).not.toThrow();

    source.destroy();

    value.destroy();
  });

  test('keeps explicit closure priorities when its value is initialized', () => {
    const source = MutableState.of(1);

    const closure = toClosure(source);

    BatchScheduler.setPriority(closure, 7);

    expect(closure.value.value).toBe(1);

    BatchScheduler.setPriority(source, 20);

    expect(BatchScheduler.getPriority(closure)).toBe(7);

    expect(BatchScheduler.getPriority(closure.value)).toBeGreaterThan(20);

    closure.destroy();

    source.destroy();
  });

  test('inherits source priority changes through initialized closure wrappers', () => {
    const source = MutableState.of(1);

    const closure = new Source({ source });

    const mapped = mapClosure(closure, (value) => value + 1);

    const initial = BatchScheduler.getPriority(mapped.value);

    BatchScheduler.setPriority(source, 10);

    expect(BatchScheduler.getPriority(mapped.value)).toBe(initial + 10);

    mapped.destroy();

    closure.destroy();

    source.destroy();
  });

  test('preserves scheduler priority through an unequal diamond dependency', () => {
    const source = MutableState.of(1);

    const short = mapState(source, (value) => value * 10);

    const longHead = mapState(source, (value) => value + 1);

    const longSource = mapState(longHead, (value) => value * 100);

    const closure = new Source({ source: longSource });

    const joinMapper = vi.fn(
      ([shortValue, longValue]: [number, number]) => `${shortValue}:${longValue}`,
    );

    const joined = combineMapState([short, closure.value], joinMapper);

    const next = vi.fn();

    joined.subscribe(next);

    joinMapper.mockClear();

    next.mockClear();

    expect(BatchScheduler.getPriority(closure.value)).toBe(
      BatchScheduler.getPriority(longSource) + 2,
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

    const closure = new Source({ source });

    closure.value.subscribe({});

    expect(source.observed).toBe(true);

    closure.destroy();

    expect(source.observed).toBe(false);

    expect(source.closed).toBe(false);

    expect(source.isStopped).toBe(false);
  });
});

describe('BaseStateClosure descriptor render values', () => {
  test('builds zero-argument class descriptors lazily', () => {
    const constructed = vi.fn();

    class TrackedNumberSource extends BaseStateClosure<number> {
      constructor() {
        super();

        constructed();
      }

      protected render() {
        return ReactiveState.of(3);
      }
    }

    const closure = new Source<number>({ source: TrackedNumberSource });

    expect(constructed).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(3);

    expect(constructed).toHaveBeenCalledOnce();

    expect(closure.value.value).toBe(3);

    expect(constructed).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('builds slotted descriptors returned by render', () => {
    const source = MutableState.of(2);

    const sourceFactory = vi.fn(() => S([InputSource, { source }]));

    const closure = new FactorySource<number>(sourceFactory);

    expect(sourceFactory).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(2);

    expect(sourceFactory).toHaveBeenCalledOnce();

    source.next(4);

    expect(closure.value.value).toBe(4);

    closure.destroy();

    source.destroy();
  });

  test('builds mapped descriptors and forwards reactive updates', () => {
    const source = MutableState.of(2);

    const mapper = vi.fn((value: number) => value * 3);

    const closure = new Source<number>({ source: S([mapper, source]) });

    expect(mapper).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(6);

    expect(mapper).toHaveBeenCalled();

    source.next(4);

    expect(closure.value.value).toBe(12);

    closure.destroy();

    source.destroy();
  });
});

describe('BaseStateClosure inputs and descriptors', () => {
  test('exposes inputs and resolves render lazily once', () => {
    const render = vi.fn(() => 2);

    const closure = new FactorySource(render);

    expect(closure.inputs.source).toBe(render);

    expect(closure.render).not.toHaveBeenCalled();

    expect(render).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(2);

    expect(closure.render).toHaveBeenCalledOnce();

    expect(render).toHaveBeenCalledOnce();

    expect(closure.value.value).toBe(2);

    expect(closure.render).toHaveBeenCalledOnce();

    expect(render).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('does not render when destroyed before lazy setup', () => {
    const render = vi.fn(() => 2);

    const closure = new FactorySource(render);

    closure.destroy();

    expect(closure.render).not.toHaveBeenCalled();

    expect(render).not.toHaveBeenCalled();

    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');
  });

  test('builds zero-argument class descriptors returned by render', () => {
    const closure = new FactorySource<number>(() => NumberSource);

    expect(closure.render).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(7);

    expect(closure.render).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('builds slotted descriptors returned by render', () => {
    const source = MutableState.of(2);

    const closure = new FactorySource<number>(() => S([InputSource, { source }]));

    expect(closure.value.value).toBe(2);

    source.next(5);

    expect(closure.value.value).toBe(5);

    expect(closure.render).toHaveBeenCalledOnce();

    closure.destroy();

    source.destroy();
  });

  test('builds mapped descriptors returned by render', () => {
    const source = MutableState.of(2);

    const mapper = vi.fn((value: number) => value * 4);

    const closure = new FactorySource<number>(() => S([mapper, source]));

    expect(mapper).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(8);

    source.next(3);

    expect(closure.value.value).toBe(12);

    expect(closure.render).toHaveBeenCalledOnce();

    closure.destroy();

    source.destroy();
  });

  test('uses D to preserve descriptor-shaped render values', () => {
    const tuple = [doubleValue, 2] as const;

    const sourceClosure = new Source<typeof tuple>({ source: D(tuple) });

    const renderClosure = new FactorySource<typeof tuple>(() => D(tuple));

    expect(sourceClosure.value.value).toBe(tuple);

    expect(renderClosure.value.value).toBe(tuple);

    sourceClosure.destroy();

    renderClosure.destroy();
  });

  test('uses D to preserve reactive objects as immediate values', () => {
    const state = MutableState.of(1);

    const subject = new BehaviorSubject(2);

    const sourceClosure = new Source<MutableState<number>>({ source: D(state) });

    const renderClosure = new FactorySource<BehaviorSubject<number>>(() => D(subject));

    expect(sourceClosure.value.value).toBe(state);

    expect(renderClosure.value.value).toBe(subject);

    state.next(3);

    subject.next(4);

    expect(sourceClosure.value.value).toBe(state);

    expect(renderClosure.value.value).toBe(subject);

    sourceClosure.destroy();

    renderClosure.destroy();

    expect(state.closed).toBe(false);

    expect(subject.closed).toBe(false);

    state.destroy();

    subject.complete();
  });

  test('destroys owned descriptor graphs exactly once', () => {
    const destroyChild = vi.fn();

    const destroyRoot = vi.fn();

    class Child extends BaseStateClosure<number> {
      protected render() {
        return ReactiveState.of(5);
      }

      override destroy() {
        destroyChild();

        super.destroy();
      }
    }

    class Parent extends BaseStateClosure<number, { child: IReadableClosure<number> }> {
      protected render() {
        const { child } = this.inputs;

        return child;
      }

      override destroy() {
        destroyRoot();

        super.destroy();
      }
    }

    const closure = new FactorySource<number>(() =>
      S([
        Parent,
        {
          child: Child,
        },
      ]),
    );

    expect(closure.value.value).toBe(5);

    closure.destroy();

    closure.destroy();

    expect(destroyRoot).toHaveBeenCalledOnce();

    expect(destroyChild).toHaveBeenCalledOnce();
  });

  test('destroys a failing owned descriptor root only once', () => {
    const destroyRoot = vi.fn();

    class FailingSource extends BaseStateClosure<number> {
      protected render(): never {
        throw new Error('Failed to render the descriptor source.');
      }

      override destroy() {
        destroyRoot();

        super.destroy();
      }
    }

    const closure = new FactorySource<number>(() => FailingSource);

    expect(() => closure.value).toThrowError('Failed to render the descriptor source.');

    expect(destroyRoot).toHaveBeenCalledOnce();

    closure.destroy();

    expect(destroyRoot).toHaveBeenCalledOnce();
  });

  test('cleans owned descriptors when reading their reactive value fails', () => {
    const constructRoot = vi.fn();

    const destroyRoot = vi.fn();

    class UnreadableSource implements IReadableClosure<number> {
      readonly value: IReactiveState<number> = {
        get value(): number {
          throw new Error('Failed to read the descriptor source.');
        },
        closed: false,
        subscribe: () => new Subscription(),
      };

      constructor() {
        constructRoot();
      }

      destroy() {
        destroyRoot();
      }
    }

    const closure = new FactorySource<number>(() => UnreadableSource);

    expect(() => closure.value).toThrowError('Failed to read the descriptor source.');

    expect(constructRoot).toHaveBeenCalledOnce();

    expect(destroyRoot).toHaveBeenCalledOnce();

    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');

    expect(constructRoot).toHaveBeenCalledOnce();

    expect(destroyRoot).toHaveBeenCalledOnce();

    closure.destroy();

    expect(destroyRoot).toHaveBeenCalledOnce();
  });

  test('owns readable closures returned by render', () => {
    const destroyExternal = vi.fn();

    class ExternalSource extends BaseStateClosure<number> {
      protected render() {
        return ReactiveState.of(9);
      }

      override destroy() {
        destroyExternal();

        super.destroy();
      }
    }

    const external = new ExternalSource();

    const closure = new FactorySource<number>(() => external);

    expect(closure.value.value).toBe(9);

    closure.destroy();

    expect(destroyExternal).toHaveBeenCalledOnce();

    expect(external.value.closed).toBe(true);

    external.destroy();

    expect(destroyExternal).toHaveBeenCalledOnce();
  });
});

describe('readable closure ownership and derivation', () => {
  test('routes readable clearable targets through shared ownership', () => {
    const subject = new BehaviorSubject(1);

    const child = toClosure(subject);

    class Owner extends Source<number> {
      constructor(source: IReadableClosure<number>) {
        super({ source });

        this.clearable(source);
      }
    }

    const first = new Owner(child);

    const second = new Owner(child);

    expect(first.value.value).toBe(1);

    expect(second.value.value).toBe(1);

    first.destroy();

    subject.next(2);

    expect(second.value.value).toBe(2);

    expect(child.value.closed).toBe(false);

    second.destroy();

    expect(child.value.closed).toBe(true);

    expect(subject.observed).toBe(false);
  });

  test('disconnects sibling derivatives before child cleanup can emit source values', () => {
    const subject = new BehaviorSubject(1);

    const mapper = vi.fn((value: number) => value * 2);

    class Owner extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
      readonly derived: IReadableClosure<number>;

      constructor(inputs: { source: IReadableClosure<number> }) {
        super(inputs);

        const { source } = this.inputs;

        this.derived = this.map(source, mapper);

        this.own({
          value: ReactiveState.of(0),
          destroy: () => subject.next(2),
        });
      }

      protected render() {
        return this.derived;
      }
    }

    const owner = new Owner({ source: toClosure(subject) });

    expect(owner.value.value).toBe(2);

    mapper.mockClear();

    owner.destroy();

    expect(mapper).not.toHaveBeenCalled();

    expect(subject.observed).toBe(false);
  });

  test('releases remaining children and resources when a child cleanup throws', () => {
    const subject = new BehaviorSubject(1);

    const source = toClosure(subject);

    const cleanup = vi.fn();

    class Owner extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
      constructor(inputs: { source: IReadableClosure<number> }) {
        super(inputs);

        this.clearable(cleanup);

        this.own({
          value: ReactiveState.of(0),
          destroy: () => {
            throw new Error('Cleanup failed.');
          },
        });
      }

      protected render() {
        const { source: input } = this.inputs;

        return input;
      }
    }

    const owner = new Owner({ source });

    expect(owner.value.value).toBe(1);

    expect(() => owner.destroy()).toThrowError('Cleanup failed.');

    expect(cleanup).toHaveBeenCalledOnce();

    expect(source.value.closed).toBe(true);

    expect(subject.observed).toBe(false);
  });

  test('does not read plain-object readable or reactive sources during construction', () => {
    const state = ReactiveState.of(2);

    const read = vi.fn(() => state);

    const closure: IReadableClosure<number> = {
      get value() {
        return read();
      },
      destroy: vi.fn(),
    };

    const mapped = mapClosure(closure, (value) => value * 2);

    expect(read).not.toHaveBeenCalled();

    expect(mapped.value.value).toBe(4);

    mapped.destroy();

    const readValue = vi.fn(() => 3);

    const source: IReactiveState<number> = {
      get value() {
        return readValue();
      },
      closed: false,
      subscribe: () => new Subscription(),
    };

    const composed = toClosure(source);

    expect(readValue).not.toHaveBeenCalled();

    expect(composed.value.value).toBe(3);

    composed.destroy();
  });

  test('constructs class derivatives without reading dependencies', () => {
    const subject = new BehaviorSubject(2);

    const createSource = vi.fn(() => subject);

    const source = new FactorySource(createSource);

    class DerivedSource extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
      readonly doubled: IReadableClosure<number>;

      readonly joined: IReadableClosure<number>;

      constructor(inputs: { source: IReadableClosure<number> }) {
        super(inputs);

        const { source: input } = this.inputs;

        this.doubled = this.map(input, (value) => value * 2);

        this.joined = this.combineMap([this.doubled, input], ([doubled, value]) => doubled + value);
      }

      protected render() {
        return this.joined;
      }
    }

    const closure = new DerivedSource({ source });

    expect(createSource).not.toHaveBeenCalled();

    expect(subject.observed).toBe(false);

    subject.next(3);

    expect(closure.value.value).toBe(9);

    expect(createSource).toHaveBeenCalledOnce();

    subject.next(4);

    expect(closure.value.value).toBe(12);

    closure.destroy();

    expect(source.value.closed).toBe(true);

    expect(closure.doubled.value.closed).toBe(true);

    expect(subject.observed).toBe(false);

    expect(subject.isStopped).toBe(false);
  });

  test('shares a readable dependency until its final owner is destroyed', () => {
    const subject = new BehaviorSubject(1);

    const source = toClosure(subject);

    const first = mapClosure(source, (value) => value * 2);

    const second = combineMapClosure([source, first], ([value, doubled]) => value + doubled);

    expect(subject.observed).toBe(false);

    expect(second.value.value).toBe(3);

    const parent = new Source({ source: first });

    expect(parent.value.value).toBe(2);

    parent.destroy();

    expect(first.value.closed).toBe(false);

    subject.next(2);

    expect(second.value.value).toBe(6);

    second.destroy();

    expect(first.value.closed).toBe(true);

    expect(source.value.closed).toBe(true);

    expect(subject.observed).toBe(false);

    expect(subject.isStopped).toBe(false);
  });

  test('releases readable children individually while preserving other owners', () => {
    const subject = new BehaviorSubject(1);

    const child = toClosure(subject);

    class Owner extends Source<number> {
      remove(owned: IReadableClosure<number>) {
        this.release(owned);
      }
    }

    const first = new Owner({ source: child });

    const second = new Owner({ source: child });

    expect(child.value.value).toBe(1);

    first.remove(child);

    expect(child.value.closed).toBe(false);

    second.remove(child);

    expect(child.value.closed).toBe(true);

    expect(subject.observed).toBe(false);

    first.destroy();

    second.destroy();
  });

  test('releases constructor resources and lazy children when construction fails', () => {
    const cleanup = vi.fn();

    const subject = new BehaviorSubject(1);

    class FailingConstructor extends BaseStateClosure<
      number,
      { source: IReadableClosure<number> }
    > {
      constructor(inputs: { source: IReadableClosure<number> }) {
        super(inputs);

        this.clearable(cleanup);

        this.map(inputs.source, (value) => value * 2).value.subscribe({});

        throw new Error('Construction failed.');
      }

      protected render() {
        const { source } = this.inputs;

        return source;
      }
    }

    expect(() => renderDescriptor(S([FailingConstructor, { source: subject }]))).toThrowError(
      'Construction failed.',
    );

    expect(cleanup).toHaveBeenCalledOnce();

    expect(subject.observed).toBe(false);

    expect(subject.isStopped).toBe(false);
  });
});

describe('readable closure construction', () => {
  test('constructs a factory closure once on its first value access', () => {
    const subject = new BehaviorSubject(1);
    const factory = vi.fn(() => subject);
    const closure = FactoryReadableClosure.create(factory);

    expect(factory).not.toHaveBeenCalled();
    expect(closure.value.value).toBe(1);

    subject.next(2);

    expect(closure.value.value).toBe(2);
    expect(factory).toHaveBeenCalledOnce();

    closure.destroy();

    expect(subject.observed).toBe(false);
    expect(subject.isStopped).toBe(false);

    subject.complete();
  });

  test('creates concrete class instances and selects owned defaults without reading their values', () => {
    const started = vi.fn();

    class Child extends BaseStateClosure<number> {
      readonly label = 'child';

      protected render() {
        started();

        return ReactiveState.of(2);
      }
    }

    class Owner extends BaseStateClosure<number> {
      readonly child = this.create(Child);

      readonly selected = this.defaults(this.child, 3);

      readonly fallback = this.defaultsFalsy(false, 4);

      protected render() {
        return this.combineMap([this.selected, this.fallback], ([selected, fallback]) => {
          return selected + fallback;
        });
      }
    }

    const owner = new Owner();

    expect(owner.child).toBeInstanceOf(Child);
    expect(owner.child.label).toBe('child');
    expect(owner.selected).toBe(owner.child);
    expect(started).not.toHaveBeenCalled();
    expect(owner.value.value).toBe(6);
    expect(started).toHaveBeenCalledOnce();

    owner.destroy();

    expect(owner.child.value.closed).toBe(true);
    expect(owner.fallback.value.closed).toBe(true);
  });
});
