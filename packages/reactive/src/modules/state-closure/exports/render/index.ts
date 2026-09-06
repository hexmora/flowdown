import type { Distinctor } from '../../../reactive-state';
import type { IReadableClosure } from '../../type';
import type { AnyOnceFunction, OnceFunctionMetadata } from '../once';
import type {
  BuiltClosure,
  ComparedMappedSlottedDescriptor,
  ImmediateDescriptor,
  JSXDescriptor,
  MappedSlottedDescriptor,
  MappingDescriptorNode,
  MappingDescriptorValue,
  SlottedDescriptor,
  StateClosureClass,
  StateClosureDescriptor,
  StateClosureInputDescriptor,
  StateClosureInputValue,
  StateClosureResultValue,
} from './utils';

import {
  buildStateClosure,
  createDescriptorScope,
  destroyDescriptorScope,
  immediateDescriptor,
  markStateClosureDescriptor,
} from './utils';

export * from './utils';

// oxlint-disable-next-line typescript/no-explicit-any
type OneArgumentStateClosureClass = StateClosureClass<any, [any]>;

// oxlint-disable-next-line typescript/no-explicit-any
type AnyMappingFunction = (params: any) => any;

type OnceFunctionInput<M extends AnyOnceFunction> =
  Parameters<M> extends [] ? {} : Parameters<M>[0];

type MapperFunctionConstraint<D extends readonly unknown[]> = D[0] extends OnceFunctionMetadata
  ? never
  : unknown;

type RuntimeSlottedDescriptor = readonly [
  OneArgumentStateClosureClass | AnyMappingFunction,
  unknown,
  unknown?,
];

/** Marks a value to bypass descriptor resolution. */
export const D = <T>(value: T): ImmediateDescriptor<T> => {
  return { [immediateDescriptor]: value };
};

/** Types a descriptor and returns it unchanged. */
export function S<
  const C extends OneArgumentStateClosureClass,
  const P extends StateClosureInputDescriptor<ConstructorParameters<C>[0]>,
>(descriptor: readonly [C, P]): SlottedDescriptor<C, P>;
export function S<
  const M extends AnyOnceFunction,
  const P extends StateClosureInputDescriptor<OnceFunctionInput<M>>,
  R,
>(
  descriptor: readonly [M, P] & readonly [(params: StateClosureInputValue<P>) => R, unknown],
): MappedSlottedDescriptor<M, P, StateClosureResultValue<R>>;
export function S<
  const D extends MappingDescriptorNode,
  R,
  const C extends Distinctor<NoInfer<R>>,
  const A extends readonly unknown[],
>(
  descriptor: readonly [(params: MappingDescriptorValue<D>) => R, D, C] &
    A &
    MapperFunctionConstraint<A>,
): ComparedMappedSlottedDescriptor<A[0], D, C, R>;
export function S<const D extends MappingDescriptorNode, R, const A extends readonly unknown[]>(
  descriptor: readonly [(params: MappingDescriptorValue<D>) => R, D] &
    A &
    MapperFunctionConstraint<A>,
): MappedSlottedDescriptor<A[0], D, R>;
export function S<T>(descriptor: JSXDescriptor<T>): JSXDescriptor<T>;
export function S(descriptor: RuntimeSlottedDescriptor | JSXDescriptor<unknown>): unknown {
  return markStateClosureDescriptor(descriptor);
}

/** Renders a descriptor tree into its root state closure. */
export function render<const D extends StateClosureDescriptor<unknown>>(
  descriptor: D,
): BuiltClosure<D>;
export function render<T>(descriptor: StateClosureDescriptor<T>): IReadableClosure<T>;
export function render(descriptor: StateClosureDescriptor<unknown>): IReadableClosure<unknown> {
  const scope = createDescriptorScope();

  try {
    return buildStateClosure(descriptor, scope, true);
  } catch (error) {
    destroyDescriptorScope(scope);

    throw error;
  }
}
