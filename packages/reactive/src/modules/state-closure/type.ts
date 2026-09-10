import type { BehaviorSubject, Subscription } from 'rxjs';

import type { IDestructible } from '../destructible';
import type { MutableState } from '../mutable-state';
import type { IReactiveState } from '../reactive-state';
import type { ImmediateDescriptor, StateClosureDescriptor } from './exports/render';

export type StateClosureDirectSource<T> = T | BehaviorSubject<T> | IReactiveState<T>;

export type StateClosureSource<T> =
  | StateClosureDirectSource<T>
  | ImmediateDescriptor<T>
  | StateClosureDescriptor<T>;

export interface IReadableClosure<T> extends IDestructible {
  readonly value: IReactiveState<T>;
}

export type FlattenedState<T> = {
  [K in keyof T]: IReadableClosure<T[K]>;
};

export type ListEntry<T, R> = {
  input: MutableState<T>;
  closure: IReadableClosure<R>;
  state: IReactiveState<R>;
  subscription?: Subscription;
};
