import { isFunction } from 'lodash-es';
import { BehaviorSubject, Subscription } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import type { IReactiveState, StateSubscriber } from '../../reactive-state';

import { BaseStateClosure, type IStateClosure, type StateClosureSource } from '..';
import { combineMapState, mapState, toReactiveState } from '../../../helpers/operator';
import { D, S } from '../../../helpers/render';
import { BatchScheduler } from '../../batch-scheduler';
import { MutableState } from '../../mutable-state';

type SourceStateClosureInputs<T> = {
  source: StateClosureSource<T>;
};

class SourceStateClosure<T> extends BaseStateClosure<T, SourceStateClosureInputs<T>> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

class WritableStateClosure<T> extends SourceStateClosure<T> {
  write(value: T) {
    this.next(value);
  }
}

class NumberStateClosure extends BaseStateClosure<number> {
  protected render() {
    return 7;
  }
}

type ReactiveInputStateClosureInputs = {
  source: IReactiveState<number>;
};

class ReactiveInputStateClosure extends BaseStateClosure<number, ReactiveInputStateClosureInputs> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

type RenderStateClosureInputs<T> = {
  source: () => StateClosureSource<T>;
};

class RenderStateClosure<T> extends BaseStateClosure<T, RenderStateClosureInputs<T>> {
  constructor(source: () => StateClosureSource<T>) {
    super({ source });
  }

  readonly render = vi.fn((): StateClosureSource<T> => {
    const { source } = this.inputs;

    return source();
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
  test('supports inherited static initial values and next updates', () => {
    const closure = new WritableStateClosure({ source: 1 });

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

    const closure = new WritableStateClosure({ source });

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

    const subjectClosure = new SourceStateClosure({ source: subjectSource });

    const subjectNext = vi.fn();

    const stateSourceSubject = new BehaviorSubject('a');

    const stateSource = toReactiveState(stateSourceSubject);

    const stateClosure = new SourceStateClosure({ source: stateSource });

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

    const closure = new SourceStateClosure({ source: source.source });

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

    const closure = new SourceStateClosure({ source: source.source });

    const value = closure.value;

    closure.destroy();

    expect(source.unsubscribe).toHaveBeenCalledOnce();

    expect(value.closed).toBe(true);
  });

  test('defers setup until value access', () => {
    const source = createTrackedReactiveSource(1);

    const closure = new SourceStateClosure({ source: source.source });

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    source.emit(2);

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    expect(closure.value.value).toBe(2);

    expect(source.subscribe).toHaveBeenCalledOnce();
  });

  test('cannot initialize after being destroyed while still lazy', () => {
    const sourceFactory = vi.fn(() => 1);

    const closure = new RenderStateClosure(sourceFactory);

    closure.destroy();

    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');

    expect(sourceFactory).not.toHaveBeenCalled();
  });

  test('sets up lazily when inherited next is called before value access', () => {
    const source = createTrackedReactiveSource(1);

    const closure = new WritableStateClosure({ source: source.source });

    expect(source.subscribe).toHaveBeenCalledTimes(0);

    closure.write(2);

    expect(source.subscribe).toHaveBeenCalledOnce();

    expect(closure.value.value).toBe(2);
  });

  test('invokes render callbacks lazily and reuses the setup result', () => {
    let current = 1;

    const sourceFactory = vi.fn(() => current);

    const closure = new RenderStateClosure(sourceFactory);

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

    const closure = new SourceStateClosure<number>({ source: callableSource });

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

    const closure = new SourceStateClosure<typeof value>({ source: value });

    expect(closure.value.value).toBe(value);

    expect(value).not.toHaveBeenCalled();

    closure.destroy();
  });

  test('updates from BehaviorSubject values returned by render', () => {
    const source = new BehaviorSubject(1);

    const sourceFactory = vi.fn(() => source);

    const closure = new RenderStateClosure(sourceFactory);

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

    const closure = new RenderStateClosure(sourceFactory);

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

    const closure = new RenderStateClosure(sourceFactory);

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

    const closure = new SourceStateClosure({ source: longSource });

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

    const closure = new SourceStateClosure({ source });

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

    class TrackedNumberStateClosure extends BaseStateClosure<number> {
      constructor() {
        super();

        constructed();
      }

      protected render() {
        return 3;
      }
    }

    const closure = new SourceStateClosure<number>({ source: TrackedNumberStateClosure });

    expect(constructed).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(3);

    expect(constructed).toHaveBeenCalledOnce();

    expect(closure.value.value).toBe(3);

    expect(constructed).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('builds slotted descriptors returned by render', () => {
    const source = MutableState.of(2);

    const sourceFactory = vi.fn(() => S([ReactiveInputStateClosure, { source }]));

    const closure = new RenderStateClosure<number>(sourceFactory);

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

    const closure = new SourceStateClosure<number>({ source: S([mapper, source]) });

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

    const closure = new RenderStateClosure(render);

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

    const closure = new RenderStateClosure(render);

    closure.destroy();

    expect(closure.render).not.toHaveBeenCalled();

    expect(render).not.toHaveBeenCalled();

    expect(() => closure.value).toThrowError('Cannot set up a destroyed state closure.');
  });

  test('builds zero-argument class descriptors returned by render', () => {
    const closure = new RenderStateClosure<number>(() => NumberStateClosure);

    expect(closure.render).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(7);

    expect(closure.render).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('builds slotted descriptors returned by render', () => {
    const source = MutableState.of(2);

    const closure = new RenderStateClosure<number>(() =>
      S([ReactiveInputStateClosure, { source }]),
    );

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

    const closure = new RenderStateClosure<number>(() => S([mapper, source]));

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

    const sourceClosure = new SourceStateClosure<typeof tuple>({ source: D(tuple) });

    const renderClosure = new RenderStateClosure<typeof tuple>(() => D(tuple));

    expect(sourceClosure.value.value).toBe(tuple);

    expect(renderClosure.value.value).toBe(tuple);

    sourceClosure.destroy();

    renderClosure.destroy();
  });

  test('uses D to preserve reactive objects as immediate values', () => {
    const state = MutableState.of(1);

    const subject = new BehaviorSubject(2);

    const sourceClosure = new SourceStateClosure<MutableState<number>>({ source: D(state) });

    const renderClosure = new RenderStateClosure<BehaviorSubject<number>>(() => D(subject));

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

    class OwnedChildStateClosure extends BaseStateClosure<number> {
      protected render() {
        return 5;
      }

      override destroy() {
        destroyChild();

        super.destroy();
      }
    }

    class OwnedRootStateClosure extends BaseStateClosure<
      number,
      { child: IReactiveState<number> }
    > {
      protected render() {
        const { child } = this.inputs;

        return child;
      }

      override destroy() {
        destroyRoot();

        super.destroy();
      }
    }

    const closure = new RenderStateClosure<number>(() =>
      S([
        OwnedRootStateClosure,
        {
          child: OwnedChildStateClosure,
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

    class ThrowingStateClosure extends BaseStateClosure<number> {
      protected render(): never {
        throw new Error('Failed to render the descriptor source.');
      }

      override destroy() {
        destroyRoot();

        super.destroy();
      }
    }

    const closure = new RenderStateClosure<number>(() => ThrowingStateClosure);

    expect(() => closure.value).toThrowError('Failed to render the descriptor source.');

    expect(destroyRoot).toHaveBeenCalledOnce();

    closure.destroy();

    expect(destroyRoot).toHaveBeenCalledOnce();
  });

  test('cleans owned descriptors when reading their reactive value fails', () => {
    const constructRoot = vi.fn();

    const destroyRoot = vi.fn();

    class ThrowingValueStateClosure implements IStateClosure<number> {
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

    const closure = new RenderStateClosure<number>(() => ThrowingValueStateClosure);

    expect(() => closure.value).toThrowError('Failed to read the descriptor source.');

    expect(constructRoot).toHaveBeenCalledOnce();

    expect(destroyRoot).toHaveBeenCalledOnce();

    expect(() => closure.value).toThrowError('Failed to read the descriptor source.');

    expect(constructRoot).toHaveBeenCalledTimes(2);

    expect(destroyRoot).toHaveBeenCalledTimes(2);

    closure.destroy();

    expect(destroyRoot).toHaveBeenCalledTimes(2);
  });

  test('does not destroy external state closures returned by render', () => {
    const destroyExternal = vi.fn();

    class ExternalStateClosure extends BaseStateClosure<number> {
      protected render() {
        return 9;
      }

      override destroy() {
        destroyExternal();

        super.destroy();
      }
    }

    const external = new ExternalStateClosure();

    const closure = new RenderStateClosure<number>(() => external);

    expect(closure.value.value).toBe(9);

    closure.destroy();

    expect(destroyExternal).not.toHaveBeenCalled();

    expect(external.value.closed).toBe(false);

    external.destroy();

    expect(destroyExternal).toHaveBeenCalledOnce();
  });
});
