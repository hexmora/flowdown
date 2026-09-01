import type { DestructibleTarget } from '../../../modules/destructible';
import type { MutableState } from '../../../modules/mutable-state';
import type { Distinctor, IReactiveState, ReactiveState } from '../../../modules/reactive-state';
import type { StateClosureSource } from '../../../modules/state-closure';
import type { StateMapper } from '../../operator';
import type { StateClosureRef } from '../type';

export type StateClosureHookResolvedSource<T> = {
  cleanup?: () => void;

  state: IReactiveState<T>;
};

export type StateClosureHookSourceResolver = <T>(
  source: StateClosureSource<T>,
) => StateClosureHookResolvedSource<T>;

export type FunctionalStateClosureResultResolver = <T>(
  source: unknown,
) => StateClosureHookResolvedSource<T>;

export type HookType = 'clearable' | 'combine' | 'combineMap' | 'compose' | 'map' | 'ref';

export type HookFinal =
  | { readonly type: 'complete' }
  | { readonly type: 'error'; readonly error: unknown };

export type HookRef<T> = {
  current: T;
};

export type RawSourceBinding = {
  readonly kind: 'raw';

  readonly state: MutableState<unknown>;
};

export type BorrowedSourceBinding = {
  readonly kind: 'borrowed';

  readonly source: unknown;

  readonly state: IReactiveState<unknown>;
};

export type SourceBinding = RawSourceBinding | BorrowedSourceBinding;

export type BaseHookSlot = {
  readonly type: HookType;

  destroy(): void;

  errorRawSources(error: unknown): void;

  completeRawSources(): void;
};

export type MapHookSlot = BaseHookSlot & {
  readonly type: 'map';

  readonly binding: SourceBinding;

  readonly distinctor: HookRef<Distinctor<unknown> | undefined>;

  readonly mapper: HookRef<StateMapper<unknown, unknown>>;

  readonly revision: MutableState<number>;

  readonly value: ReactiveState<unknown>;
};

export type CombinedHookSlot = BaseHookSlot & {
  readonly type: 'combine' | 'combineMap';

  readonly bindings: SourceBinding[];

  readonly distinctor: HookRef<Distinctor<unknown> | undefined>;

  readonly mapper: HookRef<StateMapper<unknown[], unknown>>;

  readonly revision: MutableState<number>;

  readonly value: ReactiveState<unknown>;
};

export type ComposeHookSlot = BaseHookSlot & {
  readonly type: 'compose';

  readonly source: unknown;

  readonly value: IReactiveState<unknown>;
};

export type ClearableHookSlot = BaseHookSlot & {
  readonly type: 'clearable';

  readonly target: DestructibleTarget;
};

export type RefHookSlot = BaseHookSlot & {
  readonly type: 'ref';

  readonly value: StateClosureRef<unknown>;
};

export type HookSlot =
  | ClearableHookSlot
  | CombinedHookSlot
  | ComposeHookSlot
  | MapHookSlot
  | RefHookSlot;
