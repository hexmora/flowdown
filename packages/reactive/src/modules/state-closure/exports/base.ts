import { isArray, isPlainObject, mapValues, max, values } from 'lodash-es';
import { BehaviorSubject, Subscription } from 'rxjs';
import { shallowEqual } from 'shallow-equal';

import type { DestructibleTarget } from '../../destructible';
import type {
  Distinctor,
  IReactiveState,
  StateMapper,
  StateSource,
  StateValue,
  StateValues,
} from '../../reactive-state';
import type { FlattenedState, IReadableClosure, ListEntry, StateClosureSource } from '../type';
import type {
  BuiltClosure,
  StateClosureDescriptor,
  StateClosureResult,
  StateClosureResultNode,
  StateClosureResultValue,
} from './render';

import { assert } from '../../../utils';
import { BatchScheduler } from '../../batch-scheduler';
import { Destructible } from '../../destructible';
import { clearByTarget } from '../../destructible/utils';
import { MutableState } from '../../mutable-state';
import {
  combineMapState,
  isReactiveStateLike,
  mapState,
  ReactiveState,
  toReactiveState,
  toState,
} from '../../reactive-state';
import {
  isResolvedClosureSource,
  isResolvedImmediateSource,
  resolveResult,
  resolveSource,
} from '../utils';
import { withStateClosureHookRuntime } from './hooks/runtime/utils';
import { isStateClosureDescriptor, render } from './render';
import {
  bindRootDescriptorScope,
  clearWithDescriptorScope,
  consumeDescriptorScope,
  detachWithDescriptorScope,
  getReadableClosureScope,
  ownReadableClosure,
  releaseReadableClosure,
} from './render/utils/context';
import { isReadableClosure } from './render/utils/resolve';

export const toClosure = <T>(source: StateClosureSource<T>): IReadableClosure<T> => {
  return isReadableClosure<T>(source) ? source : new SourceReadableClosure({ source });
};

export const mapClosure = <S, R>(
  source: S,
  mapper: StateMapper<StateValue<S>, R>,
  distinctor?: Distinctor<R>,
): IReadableClosure<R> => {
  return new DerivedReadableClosure(source, () =>
    mapState(
      source,
      (value, prev) => withStateClosureHookRuntime(null, () => mapper(value, prev)),
      distinctor,
    ),
  );
};

/** Derive field closures from the initial value without taking ownership of the source. */
export const flattenClosure = <T extends object>(
  source: IReadableClosure<T> | IReactiveState<T>,
): FlattenedState<T> => {
  const state = toState(source);

  return mapValues(state.value, (_, key) =>
    mapClosure(state, (value) => value[key as keyof T]),
  ) as FlattenedState<T>;
};

/**
 * Follows the latest mapped child and releases the previous child graph on replacement.
 * Completed flows retain the final child graph until the closure is destroyed.
 */
export function switchMapClosure<S, R>(
  source: S,
  mapper: (value: StateValue<S>) => R & StateClosureResultNode,
  distinctor?: Distinctor<StateClosureResultValue<R>>,
): IReadableClosure<StateClosureResultValue<R>>;
export function switchMapClosure<S, R>(
  source: S,
  mapper: (value: StateValue<S>) => StateClosureResult<R>,
  distinctor?: Distinctor<R>,
): IReadableClosure<R>;
export function switchMapClosure<S, R>(
  source: S,
  mapper: (value: StateValue<S>) => StateClosureResult<R>,
  distinctor?: Distinctor<R>,
): IReadableClosure<R> {
  const closure = FactoryReadableClosure.create(() => {
    const input = toState(source);

    const handleCreate = (value: StateValue<S>) =>
      ownReadableClosure(
        scope,
        FactoryReadableClosure.create(() =>
          render<R>(withStateClosureHookRuntime(null, () => mapper(value))),
        ),
      );

    let previous = input.value;

    let current = handleCreate(previous);

    let inner = current.value;

    const state: ReactiveState<R> = new ReactiveState({
      initial: inner.value,

      distinctor,

      emitter: (observer) => {
        const subscriptions = new Subscription();

        let subscription: Subscription | null = null;

        let stopped = false;

        let completed = false;

        const handleError = (error: unknown) => {
          if (!stopped) {
            stopped = true;

            observer.error(error);
          }
        };

        const handleSchedule = () => {
          BatchScheduler.schedule(handleUpdate);
        };

        const handleSubscribe = () => {
          subscription = inner.subscribe({
            next: handleSchedule,

            error: handleError,

            complete: handleSchedule,
          });
        };

        const handleUpdate = () => {
          if (stopped) {
            return;
          }

          try {
            const value = input.value;

            if (!Object.is(value, previous)) {
              const next = handleCreate(value);

              const nextState = next.value;

              subscription?.unsubscribe();

              releaseReadableClosure(scope, current);

              previous = value;

              current = next;

              inner = nextState;

              handleSubscribe();
            }

            observer.next(inner.value);

            if (input.closed && inner.closed) {
              stopped = true;

              completed = true;

              observer.complete();
            }
          } catch (error) {
            handleError(error);
          }
        };

        BatchScheduler.setPriority(handleUpdate, () => BatchScheduler.getPriority(state));

        BatchScheduler.batch(() => {
          handleSubscribe();

          subscriptions.add(
            input.subscribe({
              next: handleSchedule,

              error: handleError,

              complete: handleSchedule,
            }),
          );
        });

        return () => {
          stopped = true;

          subscriptions.unsubscribe();

          subscription?.unsubscribe();

          if (!completed) {
            releaseReadableClosure(scope, current);
          }
        };
      },
    });

    BatchScheduler.setPriority(
      state,
      () => (max([input, inner].map((value) => BatchScheduler.getPriority(value))) ?? 0) + 1,
    );

    detachWithDescriptorScope(scope, () => state.destroy());

    return state;
  });

  const scope = getReadableClosureScope(closure);

  if (isReadableClosure(source)) {
    ownReadableClosure(scope, source);
  }

  return closure;
}

export const combineMapClosure = <const TSources extends [unknown, ...unknown[]], R>(
  sources: [...TSources],
  mapper: StateMapper<StateValues<TSources>, R>,
  distinctor?: Distinctor<R>,
): IReadableClosure<R> => {
  return new DerivedReadableClosure(sources, () =>
    combineMapState(
      sources,
      (value, prev) => withStateClosureHookRuntime(null, () => mapper(value, prev)),
      distinctor,
    ),
  );
};

/** Keeps one owned state flow per list position and follows its current value. */
export const mapEachClosure = <T, R>(
  source: StateSource<readonly T[]>,
  mapper: (item: IReadableClosure<T>, index: number) => StateClosureSource<R>,
  itemDistinctor?: Distinctor<T>,
): IReadableClosure<R[]> => {
  const closure = FactoryReadableClosure.create(() => {
    const sourceState = input.value;

    const createEntry = (value: T, index: number): ListEntry<T, R> => {
      const item = new MutableState({ initial: value, distinctor: itemDistinctor });

      BatchScheduler.setPriority(item, () => BatchScheduler.getPriority(sourceState) + 1);

      const readable = FactoryReadableClosure.create(() => item);

      clearWithDescriptorScope(getReadableClosureScope(readable), () => item.destroy());

      const child = FactoryReadableClosure.create(() => toClosure(mapper(readable, index)));

      ownReadableClosure(getReadableClosureScope(child), readable);
      ownReadableClosure(scope, child);

      try {
        return { input: item, closure: child, state: child.value };
      } catch (error) {
        releaseReadableClosure(scope, child);

        throw error;
      }
    };

    const releaseEntries = (items: ListEntry<T, R>[]) => {
      const cleanup = new Subscription();

      for (const entry of items) {
        cleanup.add(() => {
          entry.subscription?.unsubscribe();

          releaseReadableClosure(scope, entry.closure);
        });
      }

      cleanup.unsubscribe();
    };

    let previousItems = sourceState.value;
    let entries = previousItems.map(createEntry);

    const state: ReactiveState<R[]> = new ReactiveState({
      initial: entries.map((entry) => entry.state.value),
      distinctor: shallowEqual,
      emitter: (observer) => {
        const subscriptions = new Subscription();

        let stopped = false;
        let completed = false;

        const fail = (error: unknown) => {
          if (stopped) {
            return;
          }

          stopped = true;

          observer.error(error);
        };

        const refresh = () => {
          if (stopped) {
            return;
          }

          try {
            observer.next(entries.map((entry) => entry.state.value));

            if (completed && entries.every((entry) => entry.state.closed)) {
              stopped = true;

              observer.complete();
            }
          } catch (error) {
            fail(error);
          }
        };

        const scheduleRefresh = () => {
          BatchScheduler.schedule(refresh, state);
        };

        const connectEntry = (entry: ListEntry<T, R>) => {
          entry.subscription = entry.state.subscribe({
            next: scheduleRefresh,
            error: fail,
            complete: scheduleRefresh,
          });

          subscriptions.add(entry.subscription);
        };

        const update = (items: readonly T[]) => {
          if (stopped || items === previousItems) {
            return;
          }

          const created: ListEntry<T, R>[] = [];

          try {
            for (let index = entries.length; index < items.length; index++) {
              created.push(createEntry(items[index], index));
            }

            const removed = entries.slice(items.length);

            entries = [...entries.slice(0, items.length), ...created];

            previousItems = items;

            BatchScheduler.batch(() => {
              entries.forEach((entry, index) => entry.input.next(items[index]));
              created.forEach(connectEntry);

              releaseEntries(removed);
              scheduleRefresh();
            });
          } catch (error) {
            releaseEntries(created);
            fail(error);
          }
        };

        BatchScheduler.batch(() => {
          entries.forEach(connectEntry);

          subscriptions.add(
            sourceState.subscribe({
              next: update,
              error: fail,
              complete: () => {
                completed = true;

                BatchScheduler.batch(() => {
                  entries.forEach((entry) => entry.input.complete());
                  scheduleRefresh();
                });
              },
            }),
          );
        });

        return () => {
          stopped = true;

          subscriptions.unsubscribe();
        };
      },
    });

    BatchScheduler.setPriority(state, () => {
      const priorities = [sourceState, ...entries.map((entry) => entry.state)].map((value) =>
        BatchScheduler.getPriority(value),
      );

      return (max(priorities) ?? 0) + 1;
    });

    detachWithDescriptorScope(scope, () => state.destroy());

    return state;
  });

  const scope = getReadableClosureScope(closure);
  const input = ownReadableClosure(scope, toClosure(source));

  return closure;
};

export abstract class BaseStateClosure<T, TInputs = void>
  extends Destructible
  implements IReadableClosure<T>
{
  private subject: BehaviorSubject<T> | null = null;

  private _value: IReactiveState<T> | null = null;

  readonly inputs: TInputs;

  constructor(inputs: TInputs) {
    super();

    this.inputs = inputs;

    BatchScheduler.setPriority(this, () =>
      this._value ? BatchScheduler.getPriority(this._value) : 0,
    );

    const scope = consumeDescriptorScope();

    if (scope) {
      bindRootDescriptorScope(scope, this);
    }

    clearWithDescriptorScope(getReadableClosureScope(this), () => super.destroy());

    // Descriptor inputs are already owned; rescanning would also capture D-wrapped values.
    if (scope) {
      return;
    }

    const inputValues =
      isPlainObject(inputs) && !isReactiveStateLike(inputs) && !isReadableClosure(inputs)
        ? values(inputs)
        : [inputs];

    for (const input of inputValues) {
      if (isReadableClosure(input)) {
        this.own(input);
      }
    }
  }

  private setup() {
    if (this._value !== null) {
      return this._value;
    }

    assert(!this.destroyed, 'Cannot set up a destroyed state closure.');

    try {
      const resolvedSource = resolveResult(withStateClosureHookRuntime(null, () => this.render()));

      const directSource = isResolvedClosureSource(resolvedSource)
        ? this.own(resolvedSource.source).value
        : resolvedSource.source;

      const reactiveSource =
        !isResolvedImmediateSource(resolvedSource) && isReactiveStateLike<T>(directSource)
          ? directSource
          : null;

      const initial = reactiveSource ? reactiveSource.value : (directSource as T);

      this.subject = new BehaviorSubject(initial);

      if (reactiveSource) {
        const subject = this.subject;

        let subscribing = true;

        const subscription = reactiveSource.subscribe({
          next: (value) => subject.next(subscribing ? reactiveSource.value : value),

          error: (error) => subject.error(error),

          complete: () => subject.complete(),
        });

        subscribing = false;

        detachWithDescriptorScope(getReadableClosureScope(this), () => subscription.unsubscribe());
      }

      this.clearable(this.subject);

      this._value = this.clearable(toReactiveState(this.subject));

      if (reactiveSource) {
        BatchScheduler.setPriority(
          this._value,
          () => BatchScheduler.getPriority(reactiveSource) + 1,
        );
      }

      return this._value;
    } catch (error) {
      this.destroy();

      throw error;
    }
  }

  get value(): IReactiveState<T> {
    return this.setup();
  }

  protected override clearable<R extends DestructibleTarget>(target: R): R {
    if (isReadableClosure(target)) {
      return this.own(target);
    }

    clearWithDescriptorScope(getReadableClosureScope(this), () => clearByTarget(target));

    return target;
  }

  protected map<S, R>(
    source: S,
    mapper: StateMapper<StateValue<S>, R>,
    distinctor?: Distinctor<R>,
  ): IReadableClosure<R> {
    return this.own(mapClosure(source, mapper, distinctor));
  }

  protected switchMap<S, R>(
    source: S,
    mapper: (value: StateValue<S>) => R & StateClosureResultNode,
    distinctor?: Distinctor<StateClosureResultValue<R>>,
  ): IReadableClosure<StateClosureResultValue<R>>;
  protected switchMap<S, R>(
    source: S,
    mapper: (value: StateValue<S>) => StateClosureResult<R>,
    distinctor?: Distinctor<R>,
  ): IReadableClosure<R>;
  protected switchMap<S, R>(
    source: S,
    mapper: (value: StateValue<S>) => StateClosureResult<R>,
    distinctor?: Distinctor<R>,
  ): IReadableClosure<R> {
    return this.own(switchMapClosure<S, R>(source, mapper, distinctor));
  }

  protected mapEach<A, R>(
    source: StateSource<readonly A[]>,
    mapper: (item: IReadableClosure<A>, index: number) => StateClosureSource<R>,
    itemDistinctor?: Distinctor<A>,
  ): IReadableClosure<R[]> {
    return this.own(mapEachClosure(source, mapper, itemDistinctor));
  }

  protected create<const D extends StateClosureDescriptor<unknown>>(source: D): BuiltClosure<D>;
  protected create<R>(source: StateClosureSource<R>): IReadableClosure<R>;
  protected create<R>(source: StateClosureSource<R>): IReadableClosure<R> {
    return this.own(isStateClosureDescriptor<R>(source) ? render<R>(source) : toClosure(source));
  }

  protected defaults<R>(
    source: IReadableClosure<R> | null | undefined,
    fallback: StateClosureSource<R>,
  ): IReadableClosure<R> {
    return this.create(source ?? fallback);
  }

  protected defaultsFalsy<R>(
    source: IReadableClosure<R> | null | undefined | false | 0 | '' | 0n,
    fallback: StateClosureSource<R>,
  ): IReadableClosure<R> {
    return this.create(source || fallback);
  }

  protected combineMap<const TSources extends [unknown, ...unknown[]], R>(
    sources: [...TSources],
    mapper: StateMapper<StateValues<TSources>, R>,
    distinctor?: Distinctor<R>,
  ): IReadableClosure<R> {
    return this.own(combineMapClosure(sources, mapper, distinctor));
  }

  protected combine<const TSources extends [unknown, ...unknown[]]>(
    ...sources: TSources
  ): IReadableClosure<StateValues<TSources>> {
    return this.combineMap<TSources, StateValues<TSources>>(
      sources,
      (stateValues) => stateValues,
      shallowEqual,
    );
  }

  protected own<C extends IReadableClosure<unknown>>(closure: C): C {
    return ownReadableClosure(getReadableClosureScope(this), closure);
  }

  protected release(closure: IReadableClosure<unknown>) {
    releaseReadableClosure(getReadableClosureScope(this), closure);
  }

  protected next(newValue: T) {
    this.setup();

    assert(this.subject);

    this.subject.next(newValue);
  }

  protected abstract render(): StateClosureResult<T>;
}

class SourceReadableClosure<T> extends BaseStateClosure<T, { source: StateClosureSource<T> }> {
  protected render(): StateClosureResult<T> {
    const { source } = this.inputs;

    const resolved = resolveSource(source);

    if (isResolvedClosureSource(resolved)) {
      return resolved.source;
    }

    if (!isResolvedImmediateSource(resolved) && isReactiveStateLike<T>(resolved.source)) {
      return resolved.source;
    }

    return this.clearable(ReactiveState.of(resolved.source as T));
  }
}

class DerivedReadableClosure<T, S> extends BaseStateClosure<
  T,
  { source: S; factory: () => ReactiveState<T> }
> {
  constructor(source: S, factory: () => ReactiveState<T>) {
    super({ source, factory });

    if (isArray(source)) {
      for (const item of source) {
        if (isReadableClosure(item)) {
          this.own(item);
        }
      }
    }
  }

  protected render() {
    const { factory } = this.inputs;

    const state = factory();

    detachWithDescriptorScope(getReadableClosureScope(this), () => state.destroy());

    return state;
  }
}

export class FactoryReadableClosure<T> extends BaseStateClosure<
  T,
  { factory: () => StateClosureResult<T> }
> {
  static create<T>(factory: () => StateClosureResult<T>): FactoryReadableClosure<T> {
    return new FactoryReadableClosure({ factory });
  }

  protected render() {
    const { factory } = this.inputs;

    return factory();
  }
}
