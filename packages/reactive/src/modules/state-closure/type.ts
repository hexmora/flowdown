import type { IDestructible } from '@flowdown/utils';
import type { BehaviorSubject } from 'rxjs';

import type { ImmediateDescriptor, StateClosureDescriptor } from '../descriptor/type';
import type { IReactiveState } from '../reactive-state';

export type StateClosureDirectSource<T> = T | BehaviorSubject<T> | IReactiveState<T>;

export type StateClosureSource<T> =
  | StateClosureDirectSource<T>
  | ImmediateDescriptor<T>
  | StateClosureDescriptor<T>;

export interface IStateClosure<T> extends IDestructible {
  readonly value: IReactiveState<T>;
}
