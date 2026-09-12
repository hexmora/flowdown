import {
  forOwn,
  identity,
  isArray,
  isFunction,
  isObject,
  isPlainObject,
  mapValues,
} from 'lodash-es';

import type { IReadableClosure } from '../../../type';
import type { DescriptorScope } from './context';
import type {
  ImmediateDescriptor,
  ResolvedMappingNode,
  RuntimeSlottedDescriptor,
  StateClosureDescriptor,
} from './type';

import { isClass } from '../../../../../utils';
import { isReactiveStateLike } from '../../../../reactive-state';
import { toClosure } from '../../base';
import { withStateClosureHookRuntime } from '../../hooks/runtime/utils';
import { isOnceFunction } from '../../once';
import { immediateDescriptor, isMarkedStateClosureDescriptor } from './consts';
import {
  assertDescriptorScope,
  bindRootDescriptorScope,
  createDescriptorScope,
  destroyDescriptorScope,
  ownReadableClosure,
  withDescriptorScope,
} from './context';
import { createMappedStateClosure } from './mapped';

const generatorTarget = /*#__PURE__*/ Symbol('generatorTarget');

type StateClosureGenerator = ((...params: unknown[]) => unknown) & {
  readonly [generatorTarget]?: StateClosureGenerator;
};

export const isImmediateDescriptor = <T = unknown>(
  value: unknown,
): value is ImmediateDescriptor<T> => {
  return isObject(value) && immediateDescriptor in value;
};

export const unwrapImmediateDescriptor = <T>(descriptor: ImmediateDescriptor<T>): T => {
  return descriptor[immediateDescriptor];
};

export const isReadableClosure = <T = unknown>(value: unknown): value is IReadableClosure<T> => {
  return (
    isObject(value) &&
    !isReactiveStateLike(value) &&
    'value' in value &&
    'destroy' in value &&
    isFunction(value.destroy)
  );
};

const isSlottedDescriptor = (value: unknown): value is RuntimeSlottedDescriptor => {
  return (
    isArray(value) &&
    isFunction(value[0]) &&
    (value.length === 2 ||
      (value.length === 3 &&
        !isClass(value[0]) &&
        !isOnceFunction(value[0]) &&
        (value[2] === undefined || isFunction(value[2]))))
  );
};

export const isStateClosureDescriptor = <T = unknown>(
  value: unknown,
): value is StateClosureDescriptor<T> => {
  return (
    value === null ||
    isImmediateDescriptor<T>(value) ||
    isReadableClosure<T>(value) ||
    isSlottedDescriptor(value) ||
    isClass(value)
  );
};

const isReadableSourceDescriptor = (source: unknown) => {
  return (
    isReadableClosure(source) ||
    isClass(source) ||
    (isMarkedStateClosureDescriptor(source) && isSlottedDescriptor(source))
  );
};

const resolveReadableSource = (
  source: unknown,
  scope: DescriptorScope,
): IReadableClosure<unknown> => {
  assertDescriptorScope(scope);

  if (isReadableSourceDescriptor(source)) {
    return buildStateClosure(source, scope, false);
  }

  const value = isReactiveStateLike(source) ? source : { [immediateDescriptor]: source };

  return ownReadableClosure(scope, toClosure<unknown>(value));
};

const resolveGenerator = (generator: StateClosureGenerator, scope: DescriptorScope) => {
  const target = generator[generatorTarget] ?? generator;

  const resolved: StateClosureGenerator = (...params) => {
    assertDescriptorScope(scope);

    const source = withStateClosureHookRuntime(null, () => target(...params));

    return resolveReadableSource(source, scope);
  };

  Object.defineProperty(resolved, generatorTarget, { value: target });

  return resolved;
};

const readMappingNode = (node: ResolvedMappingNode): unknown => {
  switch (node.type) {
    case 'constant':
      return node.value;
    case 'state':
      return node.closure.value.value;
    case 'array':
      return node.items.map(readMappingNode);
    case 'object':
      return mapValues(node.props, readMappingNode);
  }
};

const resolveMappingNode = (
  descriptor: unknown,
  scope: DescriptorScope,
  dependencies: IReadableClosure<unknown>[],
): ResolvedMappingNode => {
  if (isImmediateDescriptor(descriptor)) {
    return { type: 'constant', value: unwrapImmediateDescriptor(descriptor) };
  }

  if (isReactiveStateLike(descriptor) || isReadableSourceDescriptor(descriptor)) {
    const closure = resolveReadableSource(descriptor, scope);

    if (!dependencies.includes(closure)) {
      dependencies.push(closure);
    }

    return { type: 'state', closure };
  }

  if (isArray(descriptor)) {
    return {
      type: 'array',
      items: descriptor.map((item) => resolveMappingNode(item, scope, dependencies)),
    };
  }

  if (!isObject(descriptor)) {
    return { type: 'constant', value: descriptor };
  }

  if (isPlainObject(descriptor)) {
    const props: Record<string, ResolvedMappingNode> = {};

    forOwn(descriptor, (item, key) => {
      props[key] = resolveMappingNode(item, scope, dependencies);
    });

    return { type: 'object', props };
  }

  throw new TypeError('Invalid mapper input. Wrap static objects and callbacks with D().');
};

const resolveStateClosureInput = (descriptor: unknown, scope: DescriptorScope): unknown => {
  if (isImmediateDescriptor(descriptor)) {
    return unwrapImmediateDescriptor(descriptor);
  }

  if (!isObject(descriptor)) {
    return descriptor;
  }

  if (isFunction(descriptor) && !isClass(descriptor)) {
    return resolveGenerator(descriptor, scope);
  }

  return resolveReadableSource(descriptor, scope);
};

const resolveStateClosureInputs = (
  descriptor: unknown,
  scope: DescriptorScope,
  allowObjectProps: boolean,
): unknown => {
  if (isImmediateDescriptor(descriptor)) {
    return unwrapImmediateDescriptor(descriptor);
  }

  if (!isObject(descriptor)) {
    return descriptor;
  }

  if (
    (isPlainObject(descriptor) ||
      (allowObjectProps && !isArray(descriptor) && !isFunction(descriptor))) &&
    !isReactiveStateLike(descriptor) &&
    !isReadableClosure(descriptor)
  ) {
    return mapValues(descriptor, (item) => resolveStateClosureInput(item, scope));
  }

  return resolveStateClosureInput(descriptor, scope);
};

const buildSlottedStateClosure = (
  descriptor: RuntimeSlottedDescriptor,
  scope: DescriptorScope,
): IReadableClosure<unknown> => {
  const [Factory, params, distinctor] = descriptor;

  if (isClass(Factory)) {
    const inputs = resolveStateClosureInputs(
      params,
      scope,
      isMarkedStateClosureDescriptor(descriptor),
    );

    return withDescriptorScope(scope, () =>
      withStateClosureHookRuntime(null, () => new Factory(inputs)),
    );
  }

  if (isOnceFunction(Factory)) {
    const inputs = resolveStateClosureInputs(
      params,
      scope,
      isMarkedStateClosureDescriptor(descriptor),
    );

    return createMappedStateClosure(Factory, () => inputs, [], 'once');
  }

  const dependencies: IReadableClosure<unknown>[] = [];

  const node = resolveMappingNode(params, scope, dependencies);

  return createMappedStateClosure(
    Factory,
    () => readMappingNode(node),
    dependencies,
    'mapper',
    distinctor,
  );
};

/** Resolves class and once inputs without reading their reactive values. */
export const resolveDescriptor = (descriptor: unknown, scope: DescriptorScope): unknown => {
  return resolveStateClosureInputs(descriptor, scope, false);
};

export const buildStateClosure = (
  descriptor: unknown,
  scope: DescriptorScope,
  root: boolean,
): IReadableClosure<unknown> => {
  assertDescriptorScope(scope);

  if (isReadableClosure(descriptor)) {
    return root ? descriptor : ownReadableClosure(scope, descriptor);
  }

  const closureScope = root ? scope : createDescriptorScope();

  try {
    let closure: IReadableClosure<unknown>;

    if (
      descriptor === null ||
      isImmediateDescriptor(descriptor) ||
      isReactiveStateLike(descriptor)
    ) {
      closure = toClosure(descriptor);
    } else if (isSlottedDescriptor(descriptor)) {
      closure = buildSlottedStateClosure(descriptor, closureScope);
    } else if (isClass(descriptor)) {
      closure = withDescriptorScope(closureScope, () =>
        withStateClosureHookRuntime(null, () => new descriptor()),
      );
    } else {
      const dependencies: IReadableClosure<unknown>[] = [];

      const node = resolveMappingNode(descriptor, closureScope, dependencies);

      closure = createMappedStateClosure(
        identity,
        () => readMappingNode(node),
        dependencies,
        'mapper',
      );
    }

    bindRootDescriptorScope(closureScope, closure);

    return root ? closure : ownReadableClosure(scope, closure);
  } catch (error) {
    destroyDescriptorScope(closureScope);

    throw error;
  }
};
