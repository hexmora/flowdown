import type { IDestructible } from '@flowdown/utils';
import type { BehaviorSubject } from 'rxjs';

import type { IReactiveState } from '../reactive-state';

export type BaseStateClosureRawSource<T> = T | BehaviorSubject<T> | IReactiveState<T>;

export type BaseStateClosureSource<T> =
  | BaseStateClosureRawSource<T>
  | (() => BaseStateClosureRawSource<T>);

export type BaseStateClosureParams<T> = {
  source: BaseStateClosureSource<T>;

  /**
   * Defer internal state setup until the closure value is first used.
   * @default true
   */
  lazy?: boolean;
};

export interface IStateClosure<T> extends IDestructible {
  readonly value: IReactiveState<T>;
}
