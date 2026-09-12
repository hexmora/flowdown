import type { IReactiveState, ReactiveState, ReactiveStateParams } from '../reactive-state';

export type MutableStateParams<T> = ReactiveStateParams<T>;

export interface IMutableState<T> extends IReactiveState<T> {
  next(value: T): void;

  error(error: unknown): void;

  complete(): void;

  toReadonly(): ReactiveState<T>;
}
