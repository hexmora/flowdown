import { shallowEqual } from 'shallow-equal';

import type { DestructibleTarget } from '../../../destructible';
import type {
  Distinctor,
  StateMapper,
  StateSource,
  StateValue,
  StateValues,
} from '../../../reactive-state';
import type { IReadableClosure, StateClosureSource } from '../../type';
import type { BuiltClosure, StateClosureDescriptor } from '../render';
import type { StateClosureRef } from './type';

import { combineMapClosure, mapClosure, mapEachClosure, toClosure } from '../base';
import { isStateClosureDescriptor, render } from '../render';
import { getReadableClosureScope, ownReadableClosure } from '../render/utils/context';
import { getCurrentStateClosureHookRuntime } from './runtime/utils';

export * from './type';

export const useMap = <S, R>(
  source: S,
  mapper: StateMapper<StateValue<S>, R>,
  distinctor?: Distinctor<R>,
): IReadableClosure<R> => {
  const { owner } = getCurrentStateClosureHookRuntime('useMap', 'once');

  return ownReadableClosure(getReadableClosureScope(owner), mapClosure(source, mapper, distinctor));
};

export const useMapEach = <T, R>(
  source: StateSource<readonly T[]>,
  mapper: (item: IReadableClosure<T>, index: number) => StateClosureSource<R>,
  itemDistinctor?: Distinctor<T>,
): IReadableClosure<R[]> => {
  const { owner } = getCurrentStateClosureHookRuntime('useMapEach', 'once');

  return ownReadableClosure(
    getReadableClosureScope(owner),
    mapEachClosure(source, mapper, itemDistinctor),
  );
};

export const useCombineMap = <const TSources extends [unknown, ...unknown[]], R>(
  sources: [...TSources],
  mapper: StateMapper<StateValues<TSources>, R>,
  distinctor?: Distinctor<R>,
): IReadableClosure<R> => {
  const { owner } = getCurrentStateClosureHookRuntime('useCombineMap', 'once');

  return ownReadableClosure(
    getReadableClosureScope(owner),
    combineMapClosure(sources, mapper, distinctor),
  );
};

export function useCreate<const D extends StateClosureDescriptor<unknown>>(
  source: D,
): BuiltClosure<D>;
export function useCreate<T>(source: StateClosureSource<T>): IReadableClosure<T>;
export function useCreate<T>(source: StateClosureSource<T>): IReadableClosure<T> {
  const { owner } = getCurrentStateClosureHookRuntime('useCreate', 'once');

  return ownReadableClosure(
    getReadableClosureScope(owner),
    isStateClosureDescriptor<T>(source) ? render<T>(source) : toClosure(source),
  );
}

export const useDefaults = <T>(
  source: IReadableClosure<T> | null | undefined,
  fallback: StateClosureSource<T>,
): IReadableClosure<T> => {
  getCurrentStateClosureHookRuntime('useDefaults', 'once');

  return useCreate(source ?? fallback);
};

export const useDefaultsFalsy = <T>(
  source: IReadableClosure<T> | null | undefined | false | 0 | '' | 0n,
  fallback: StateClosureSource<T>,
): IReadableClosure<T> => {
  getCurrentStateClosureHookRuntime('useDefaultsFalsy', 'once');

  return useCreate(source || fallback);
};

export const useCombine = <const TSources extends [unknown, ...unknown[]]>(
  ...sources: TSources
): IReadableClosure<StateValues<TSources>> => {
  return useCombineMap<TSources, StateValues<TSources>>(sources, (values) => values, shallowEqual);
};

export const useClearable = <T extends DestructibleTarget>(target: T): T => {
  return getCurrentStateClosureHookRuntime('useClearable').clearable(target);
};

export const useRef = <T>(initialValue: T): StateClosureRef<T> => {
  return getCurrentStateClosureHookRuntime('useRef', 'mapper').ref(initialValue);
};

export const useStableFn = <TParams extends unknown[], TReturn>(
  callback: (...params: TParams) => TReturn,
): ((...params: TParams) => TReturn) => {
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  const stableCallbackRef = useRef((...params: TParams) => callbackRef.current(...params));

  return stableCallbackRef.current;
};
