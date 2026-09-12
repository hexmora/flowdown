import type { BehaviorSubject, Observer, Subscription, TeardownLogic } from 'rxjs';

import type { IReadableClosure } from '../state-closure';

export type NextFunction<T> = (value: T) => void;

export type EmitterFunction<T> = (observer: Observer<T>) => TeardownLogic;

export type Distinctor<T> = (from: T, to: T) => boolean;

export type StateSubscriber<T> = NextFunction<T> | Partial<Observer<T>>;

export type ReactiveStateParams<T> = {
  initial: T;

  emitter?: EmitterFunction<T>;

  distinctor?: Distinctor<T>;

  /**
   * Defer side effects that drive value updates until the value or value state
   * is accessed.
   * @default true
   */
  lazy?: boolean;
};

export type IReactiveState<T> = {
  readonly value: T;

  readonly closed: boolean;

  subscribe(subscriber: StateSubscriber<T>): Subscription;
};

export type StateValue<T> =
  T extends IReactiveState<infer V>
    ? V
    : T extends BehaviorSubject<infer V>
      ? V
      : T extends IReadableClosure<infer V>
        ? V
        : T;

export type StateSource<T> =
  T extends IReactiveState<unknown>
    ? T
    : T extends BehaviorSubject<unknown>
      ? T
      : T extends IReadableClosure<unknown>
        ? T
        : T | IReactiveState<T> | BehaviorSubject<T> | IReadableClosure<T>;

export type StateValues<TSources extends readonly unknown[]> = {
  [K in keyof TSources]: StateValue<TSources[K]>;
};

export type StateMapper<A, B> = (value: A, prev: [A, B] | null) => B;
