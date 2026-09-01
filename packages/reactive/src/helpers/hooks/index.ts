import type { DestructibleTarget } from '../../modules/destructible';
import type { Distinctor, IReactiveState, ReactiveState } from '../../modules/reactive-state';
import type { StateClosureSource } from '../../modules/state-closure';
import type { StateMapper, StateValue, StateValues } from '../operator';
import type { StateClosureRef } from './type';

import { getCurrentStateClosureHookRuntime } from './runtime/utils';

export * from './type';

export const useMap = <S, R>(
  source: S,
  mapper: StateMapper<StateValue<S>, R>,
  distinctor?: Distinctor<R>,
): ReactiveState<R> => {
  const runtime = getCurrentStateClosureHookRuntime();

  return runtime.map(source, mapper, distinctor);
};

export const useCombineMap = <const TSources extends [unknown, ...unknown[]], R>(
  sources: [...TSources],
  mapper: StateMapper<StateValues<TSources>, R>,
  distinctor?: Distinctor<R>,
): ReactiveState<R> => {
  const runtime = getCurrentStateClosureHookRuntime();

  return runtime.combineMap(sources, mapper, distinctor);
};

export const useCombine = <const TSources extends [unknown, ...unknown[]]>(
  ...sources: TSources
): ReactiveState<StateValues<TSources>> => {
  const runtime = getCurrentStateClosureHookRuntime();

  return runtime.combine(...sources);
};

export const useCompose = <T>(source: StateClosureSource<T>): IReactiveState<T> => {
  const runtime = getCurrentStateClosureHookRuntime();

  return runtime.compose(source);
};

export const useClearable = <T extends DestructibleTarget>(target: T): T => {
  const runtime = getCurrentStateClosureHookRuntime();

  return runtime.clearable(target);
};

export const useRef = <T>(initialValue: T): StateClosureRef<T> => {
  const runtime = getCurrentStateClosureHookRuntime();

  return runtime.ref(initialValue);
};

export const useStableFn = <TParams extends unknown[], TReturn>(
  callback: (...params: TParams) => TReturn,
): ((...params: TParams) => TReturn) => {
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  const stableCallbackRef = useRef((...params: TParams) => callbackRef.current(...params));

  return stableCallbackRef.current;
};
