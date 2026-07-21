import type { Observer, Subscription, TeardownLogic } from 'rxjs';

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
