import { forOwn, isArray, isFunction, isObject, isPlainObject, mapValues } from 'lodash-es';

import type { IReactiveState } from '../../../modules/reactive-state';
import type { IStateClosure, StateClosureSource } from '../../../modules/state-closure';
import type {
  FunctionalStateClosureResultResolver,
  StateClosureHookSourceResolver,
} from '../../hooks/runtime';
import type { DescriptorScope } from './context';
import type {
  AnyMappingFunction,
  AnyStateClosureClass,
  ResolvedMappingNode,
  RuntimeImmediateDescriptor,
  RuntimeSlottedDescriptor,
  StateClosureDescriptor,
} from './type';

import { ReactiveState } from '../../../modules/reactive-state';
import { isClass } from '../../../utils';
import { getMemoedDistinctor } from '../../memo';
import { isReactiveStateLike } from '../../operator';
import { immediateDescriptor, isMarkedStateClosureDescriptor } from './consts';
import {
  assertDescriptorScope,
  bindRootDescriptorScope,
  clearWithDescriptorScope,
  createDescriptorScope,
  destroyDescriptorScope,
  ownStateClosure,
} from './context';
import { MappedStateClosure } from './mapped';

type StateClosureDescriptorResolution = {
  cleanup?: () => void;

  closure: IStateClosure<unknown>;
};

type StateClosureDescriptorResolver = (
  descriptor: StateClosureDescriptor<unknown>,
) => StateClosureDescriptorResolution;

export const isImmediateDescriptor = <T = unknown>(
  value: unknown,
): value is RuntimeImmediateDescriptor<T> => {
  return isObject(value) && immediateDescriptor in value;
};

export const unwrapImmediateDescriptor = <T>(descriptor: RuntimeImmediateDescriptor<T>): T => {
  return descriptor[immediateDescriptor];
};

export const isStateClosure = <T = unknown>(value: unknown): value is IStateClosure<T> => {
  return isObject(value) && 'value' in value && 'destroy' in value && isFunction(value.destroy);
};

const isSlottedDescriptor = (value: unknown): value is RuntimeSlottedDescriptor => {
  if (!isArray(value) || !isFunction(value[0])) {
    return false;
  }

  if (value.length === 2) {
    return true;
  }

  return (
    value.length === 3 && !isClass(value[0]) && (value[2] === undefined || isFunction(value[2]))
  );
};

const isStateClosureClass = (
  value: AnyStateClosureClass | AnyMappingFunction,
): value is AnyStateClosureClass => isClass(value);

const getStateClosureState = <T>(source: unknown): IReactiveState<T> | null => {
  if (!isStateClosure<T>(source)) {
    return null;
  }

  const state = source.value;

  return isReactiveStateLike<T>(state) ? state : null;
};

export const isStateClosureDescriptor = <T = unknown>(
  value: unknown,
): value is StateClosureDescriptor<T> => {
  return isStateClosure<T>(value) || isSlottedDescriptor(value) || isClass(value);
};

const toImmediateDescriptor = (value: unknown): RuntimeImmediateDescriptor<unknown> => {
  return { [immediateDescriptor]: value } as RuntimeImmediateDescriptor<unknown>;
};

const toDescriptorParameter = (value: unknown): unknown => {
  if (isReactiveStateLike(value)) {
    return value;
  }

  if (isStateClosure(value)) {
    return value.value;
  }

  if (!isObject(value) || isFunction(value) || (!isArray(value) && !isPlainObject(value))) {
    return toImmediateDescriptor(value);
  }

  if (isArray(value)) {
    return value.map(toDescriptorParameter);
  }

  return mapValues(value, toDescriptorParameter);
};

const collectReactiveStates = (value: unknown, states: IReactiveState<unknown>[]) => {
  if (isReactiveStateLike(value)) {
    if (!states.includes(value)) {
      states.push(value);
    }

    return;
  }

  if (isStateClosure(value)) {
    collectReactiveStates(value.value, states);

    return;
  }

  if (!isArray(value) && !isPlainObject(value)) {
    return;
  }

  if (isArray(value)) {
    for (const item of value) {
      collectReactiveStates(item, states);
    }

    return;
  }

  forOwn(value, (item) => collectReactiveStates(item, states));
};

const releaseScopeWhenSourcesEnd = (scope: DescriptorScope, sources: IReactiveState<unknown>[]) => {
  let completed = 0;

  for (const source of sources) {
    if (scope.destroyed) {
      break;
    }

    const subscription = source.subscribe({
      complete: () => {
        completed += 1;

        if (completed === sources.length) {
          destroyDescriptorScope(scope);
        }
      },
      error: () => destroyDescriptorScope(scope),
    });

    if (!scope.destroyed && !subscription.closed) {
      clearWithDescriptorScope(scope, () => subscription.unsubscribe());
    }
  }
};

const resolveGenerator = (
  generator: (...params: unknown[]) => unknown,
  params: unknown[],
  scope: DescriptorScope,
) => {
  const sources: IReactiveState<unknown>[] = [];

  for (const param of params) {
    collectReactiveStates(param, sources);
  }

  const descriptorParams = params.map(toDescriptorParameter);

  const liveSources = sources.filter((source) => !source.closed);

  if (liveSources.length === 0) {
    return resolveDescriptor(generator(...descriptorParams), scope);
  }

  const invocationScope = createDescriptorScope(scope);

  try {
    const result = resolveDescriptor(generator(...descriptorParams), invocationScope);

    releaseScopeWhenSourcesEnd(invocationScope, liveSources);

    return result;
  } catch (error) {
    destroyDescriptorScope(invocationScope);

    throw error;
  }
};

const readMappingNode = (node: ResolvedMappingNode): unknown => {
  if (isArray(node)) {
    return node.map(readMappingNode);
  }

  if ('type' in node && node.type === 'constant') {
    return node.value;
  }

  if ('type' in node && node.type === 'state') {
    return node.state.value;
  }

  return mapValues(node, readMappingNode);
};

const addMappingState = (
  state: IReactiveState<unknown>,
  sources: IReactiveState<unknown>[],
): ResolvedMappingNode => {
  if (!sources.includes(state)) {
    sources.push(state);
  }

  return { type: 'state', state };
};

const resolveMappingNode = (
  descriptor: unknown,
  scope: DescriptorScope,
  sources: IReactiveState<unknown>[],
): ResolvedMappingNode => {
  if (isImmediateDescriptor(descriptor)) {
    return { type: 'constant', value: descriptor[immediateDescriptor] };
  }

  if (isReactiveStateLike(descriptor)) {
    return addMappingState(descriptor, sources);
  }

  if (isStateClosure(descriptor)) {
    return addMappingState(descriptor.value, sources);
  }

  if (isSlottedDescriptor(descriptor) || isClass(descriptor)) {
    return addMappingState(buildStateClosure(descriptor, scope, false).value, sources);
  }

  if (isFunction(descriptor)) {
    return { type: 'constant', value: resolveDescriptor(descriptor, scope) };
  }

  if (isArray(descriptor)) {
    return descriptor.map((item) => resolveMappingNode(item, scope, sources));
  }

  if (isPlainObject(descriptor)) {
    const nodes: Record<string, ResolvedMappingNode> = {};

    forOwn(descriptor, (item, key) => {
      nodes[key] = resolveMappingNode(item, scope, sources);
    });

    return nodes;
  }

  if (!isObject(descriptor)) {
    return { type: 'constant', value: descriptor };
  }

  throw new TypeError('Invalid mapping descriptor. Wrap constant values with D().');
};

const createHookDescriptorResolver = (scope: DescriptorScope): StateClosureDescriptorResolver => {
  return (descriptor) => {
    assertDescriptorScope(scope);

    if (isStateClosure(descriptor)) {
      return { closure: descriptor };
    }

    const childScope = createDescriptorScope(scope);

    try {
      return {
        closure: buildStateClosure(descriptor, childScope, false),
        cleanup: () => destroyDescriptorScope(childScope),
      };
    } catch (error) {
      destroyDescriptorScope(childScope);

      throw error;
    }
  };
};

const createHookSourceResolver = (
  scope: DescriptorScope,
  allowUnmarkedDescriptor = false,
  resolveDescriptor: StateClosureDescriptorResolver = createHookDescriptorResolver(scope),
): StateClosureHookSourceResolver => {
  return <T>(source: unknown) => {
    assertDescriptorScope(scope);

    if (isImmediateDescriptor<T>(source)) {
      const state = ReactiveState.of(unwrapImmediateDescriptor(source));

      return {
        state,
        cleanup: () => state.destroy(),
      };
    }

    if (isReactiveStateLike<T>(source)) {
      return { state: source };
    }

    const closureState = getStateClosureState<T>(source);

    if (closureState) {
      return { state: closureState };
    }

    if (
      ((allowUnmarkedDescriptor || isMarkedStateClosureDescriptor(source)) &&
        isSlottedDescriptor(source)) ||
      isClass(source)
    ) {
      const resolved = resolveDescriptor(source as StateClosureDescriptor<unknown>);

      try {
        const state = resolved.closure.value as IReactiveState<T>;

        return {
          state,
          cleanup: resolved.cleanup,
        };
      } catch (error) {
        resolved.cleanup?.();

        throw error;
      }
    }

    const state = ReactiveState.of(source as T);

    return {
      state,
      cleanup: () => state.destroy(),
    };
  };
};

const buildSlottedStateClosure = (
  descriptor: RuntimeSlottedDescriptor,
  scope: DescriptorScope,
  root: boolean,
): IStateClosure<unknown> => {
  const [Factory, params, distinctor] = descriptor;

  let closure: IStateClosure<unknown>;

  if (isStateClosureClass(Factory)) {
    closure = new Factory(resolveDescriptor(params, scope));
  } else {
    const sources: IReactiveState<unknown>[] = [];

    const node = resolveMappingNode(params, scope, sources);

    const resolveHookDescriptor = createHookDescriptorResolver(scope);

    const resolveResultSource = createHookSourceResolver(scope, false, resolveHookDescriptor);

    const resolveHookSource = createHookSourceResolver(scope, true, resolveHookDescriptor);

    const resolveResult: FunctionalStateClosureResultResolver = <T>(source: unknown) => {
      return resolveResultSource<T>(source as StateClosureSource<T>);
    };

    closure = new MappedStateClosure(
      () => Factory(readMappingNode(node)),
      sources as [] | [IReactiveState<unknown>, ...IReactiveState<unknown>[]],
      resolveResult,
      resolveHookSource,
      distinctor ?? getMemoedDistinctor(Factory),
    );
  }

  return root ? bindRootDescriptorScope(scope, closure) : ownStateClosure(scope, closure);
};

export const resolveDescriptor = (descriptor: unknown, scope: DescriptorScope): unknown => {
  if (isImmediateDescriptor(descriptor)) {
    return descriptor[immediateDescriptor];
  }

  if (isReactiveStateLike(descriptor)) {
    return descriptor;
  }

  if (isStateClosure(descriptor)) {
    return descriptor.value;
  }

  if (isSlottedDescriptor(descriptor) || isClass(descriptor)) {
    return buildStateClosure(descriptor, scope, false).value;
  }

  if (isFunction(descriptor)) {
    return (...params: unknown[]) => {
      assertDescriptorScope(scope);

      return resolveGenerator(descriptor, params, scope);
    };
  }

  if (isArray(descriptor)) {
    return descriptor.map((item) => resolveDescriptor(item, scope));
  }

  if (isPlainObject(descriptor)) {
    return mapValues(descriptor as Record<string, unknown>, (item) =>
      resolveDescriptor(item, scope),
    );
  }

  if (!isObject(descriptor)) {
    return descriptor;
  }

  throw new TypeError('Invalid descriptor. Wrap immediate values with D().');
};

export const buildStateClosure = (
  descriptor: unknown,
  scope: DescriptorScope,
  root: boolean,
): IStateClosure<unknown> => {
  assertDescriptorScope(scope);

  if (isStateClosure(descriptor)) {
    return descriptor;
  }

  if (isSlottedDescriptor(descriptor)) {
    return buildSlottedStateClosure(descriptor, scope, root);
  }

  if (isClass(descriptor)) {
    const closure = new descriptor();

    return root ? bindRootDescriptorScope(scope, closure) : ownStateClosure(scope, closure);
  }

  throw new TypeError('Invalid state closure descriptor.');
};
