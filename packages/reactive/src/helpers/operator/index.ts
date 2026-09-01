import { isFunction, isNaN, isObject, isUndefined, max } from 'lodash-es';
import { BehaviorSubject, Observable, type Subscription } from 'rxjs';
import { shallowEqual } from 'shallow-equal';

import type { Distinctor, IReactiveState } from '../../modules/reactive-state';
import type { IStateClosure } from '../../modules/state-closure';

import { BatchScheduler } from '../../modules/batch-scheduler';
import { ReactiveState } from '../../modules/reactive-state';
import { compute } from '../../utils';

type ReactiveStateSource<T> = IReactiveState<T> | BehaviorSubject<T>;

export type StateValue<T> =
  T extends IReactiveState<infer V>
    ? V
    : T extends BehaviorSubject<infer V>
      ? V
      : T extends IStateClosure<infer V>
        ? V
        : T;

export type StateSource<T> =
  T extends IReactiveState<unknown>
    ? T
    : T extends BehaviorSubject<unknown>
      ? T
      : T extends IStateClosure<unknown>
        ? T
        : T | IReactiveState<T> | BehaviorSubject<T> | IStateClosure<T>;

export type StateValues<TSources extends readonly unknown[]> = {
  [K in keyof TSources]: StateValue<TSources[K]>;
};

export type StateMapper<A, B> = (value: A, prev: [A, B] | null) => B;

const createMappedState = <A, B>(
  source: ReactiveStateSource<A>,
  initialSource: A,
  mapper: StateMapper<A, B>,
  distinctor?: Distinctor<B>,
): ReactiveState<B> => {
  const initial = mapper(initialSource, null);

  let prev: [A, B] = [initialSource, initial];

  const state = new ReactiveState({
    initial,
    emitter: (observer) => {
      const subscription = source.subscribe({
        next: (value) => {
          const nextResult = mapper(value, prev);

          observer.next(nextResult);

          prev = [value, nextResult];
        },
        error: (error) => observer.error(error),
        complete: () => observer.complete(),
      });

      return () => {
        subscription.unsubscribe();
      };
    },
    distinctor,
  });

  BatchScheduler.setPriority(state, BatchScheduler.getPriority(source) + 1);

  return state;
};

export const isReactiveStateLike = <T = unknown>(value: unknown): value is IReactiveState<T> =>
  isObject(value) &&
  'value' in value &&
  'closed' in value &&
  isFunction((value as Partial<IReactiveState<T>>).subscribe);

const isStateClosureLike = <T = unknown>(value: unknown): value is IStateClosure<T> => {
  return (
    isObject(value) &&
    'value' in value &&
    'destroy' in value &&
    isFunction(value.destroy) &&
    isReactiveStateLike<T>(value.value)
  );
};

const isStateSourceLike = (value: unknown) => {
  return isReactiveStateLike(value) || isStateClosureLike(value);
};

export const toState = <S>(source: S): IReactiveState<StateValue<S>> => {
  if (isReactiveStateLike<StateValue<S>>(source)) {
    return source;
  }

  if (isStateClosureLike<StateValue<S>>(source)) {
    return source.value;
  }

  return ReactiveState.of(source as StateValue<S>);
};

export function toReactiveState<T>(
  observable: Observable<T>,
  current: T,
  distinctor?: Distinctor<T>,
): ReactiveState<T>;
export function toReactiveState<T>(
  subject: BehaviorSubject<T>,
  distinctor?: Distinctor<T>,
): ReactiveState<T>;
export function toReactiveState<T>(
  source: Observable<T> | BehaviorSubject<T>,
  currentOrDistinctor?: T | Distinctor<T>,
  distinctor?: Distinctor<T>,
): ReactiveState<T> {
  const isBehaviorSubject = source instanceof BehaviorSubject;

  const initial = compute(() => {
    if (isBehaviorSubject) {
      return source.value;
    }

    if (isFunction(currentOrDistinctor) || isUndefined(currentOrDistinctor)) {
      throw new TypeError('Observable sources require an explicit current value.');
    }

    return currentOrDistinctor;
  });

  const stateDistinctor = compute(() => {
    if (!isBehaviorSubject) {
      return distinctor;
    }

    if (currentOrDistinctor !== undefined && !isFunction(currentOrDistinctor)) {
      throw new TypeError('BehaviorSubject sources accept a distinctor, not a current value.');
    }

    return currentOrDistinctor as Distinctor<T> | undefined;
  });

  return new ReactiveState({
    initial,
    emitter: (observer) =>
      source.subscribe({
        next: (value) => {
          observer.next(value);
        },
        error: (error) => {
          observer.error(error);
        },
        complete: () => {
          observer.complete();
        },
      }),
    distinctor: stateDistinctor,
  });
}

export const mapState = <S, B>(
  source: S,
  mapper: StateMapper<StateValue<S>, B>,
  distinctor?: Distinctor<B>,
): ReactiveState<B> => {
  if (!isStateSourceLike(source)) {
    return ReactiveState.of(mapper(source as StateValue<S>, null));
  }

  const state = toState(source);

  return createMappedState(state, state.value, mapper, distinctor);
};

export const combineMapState = <const TSources extends [unknown, ...unknown[]], T>(
  sources: [...TSources],
  mapper: StateMapper<StateValues<TSources>, T>,
  distinctor?: Distinctor<T>,
): ReactiveState<T> => {
  type TValues = StateValues<TSources>;

  if (sources.every((source) => !isStateSourceLike(source))) {
    return ReactiveState.of(mapper(sources as TValues, null));
  }

  const states = sources.map(toState) as {
    [K in keyof TSources]: IReactiveState<StateValue<TSources[K]>>;
  };

  const initialValues = states.map((state) => state.value) as TValues;

  const initial = mapper(initialValues, null);

  let prev: [TValues, T] = [initialValues, initial];

  const state = new ReactiveState({
    initial,
    emitter: (observer) => {
      const latestValues = [...initialValues] as TValues;

      const completed = states.map(() => false);

      let previousValues: TValues | null = null;

      let closed = false;

      let failed = false;

      let finalError: unknown;

      const refresh = () => {
        if (closed) {
          return;
        }

        if (failed) {
          closed = true;

          observer.error(finalError);

          return;
        }

        for (let index = 0; index < states.length; index++) {
          latestValues[index] = states[index].value;
        }

        const nextValues = [...latestValues] as TValues;

        if (!previousValues || !shallowEqual(nextValues, previousValues)) {
          previousValues = nextValues;

          const nextResult = mapper(nextValues, prev);

          prev = [nextValues, nextResult];

          observer.next(nextResult);
        }

        if (!completed.every(Boolean)) {
          return;
        }

        closed = true;

        observer.complete();
      };

      const scheduleRefresh = () => {
        BatchScheduler.schedule(refresh, state);
      };

      const subscriptions: Subscription[] = [];

      for (let index = 0; index < states.length; index++) {
        if (closed) {
          break;
        }

        const subscription = states[index].subscribe({
          next: () => {
            if (closed) {
              return;
            }

            scheduleRefresh();
          },
          error: (error) => {
            if (closed || failed) {
              return;
            }

            failed = true;

            finalError = error;

            scheduleRefresh();
          },
          complete: () => {
            if (closed) {
              return;
            }

            completed[index] = true;

            scheduleRefresh();
          },
        });

        subscriptions.push(subscription);
      }

      return () => {
        closed = true;

        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
      };
    },
    distinctor,
  });

  const sourcePriorities = states.map((source) => BatchScheduler.getPriority(source));

  const sourcePriority = sourcePriorities.some(isNaN) ? NaN : (max(sourcePriorities) ?? 0);

  BatchScheduler.setPriority(state, sourcePriority + 1);

  return state;
};

export const combineState = <const TSources extends [unknown, ...unknown[]]>(
  ...sources: TSources
): ReactiveState<StateValues<TSources>> =>
  combineMapState<TSources, StateValues<TSources>>(sources, (values) => values, shallowEqual);
