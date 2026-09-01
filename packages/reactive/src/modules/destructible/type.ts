import type { Subject, Subscription } from 'rxjs';

export interface IDestructible {
  destroy: () => void;
}

export type DestructibleFunctionTarget = () => void;

export type DestructibleTarget =
  | Subscription
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | Subject<any>
  | DestructibleFunctionTarget
  | IDestructible;
