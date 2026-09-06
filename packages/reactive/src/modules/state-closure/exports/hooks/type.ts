import type { IReadableClosure } from '../../type';

export type StateClosureRef<T> = {
  current: T;
};

export type FlattenedState<T> = {
  [K in keyof T]: IReadableClosure<T[K]>;
};
