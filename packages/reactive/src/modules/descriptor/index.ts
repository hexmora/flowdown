import type { Distinctor } from '../reactive-state';
import type { IStateClosure } from '../state-closure';
import type {
  BuiltStateClosure,
  Descriptor,
  ImmediateDescriptor,
  JSXDescriptor,
  MappedSlottedDescriptor,
  MappingDescriptorNode,
  MappingDescriptorValue,
  SlottedDescriptor,
  StateClosureClass,
  StateClosureDescriptor,
} from './type';

import { immediateDescriptor } from './utils/consts';
import { createDescriptorScope, destroyDescriptorScope } from './utils/context';
import { buildStateClosure } from './utils/resolve';

export * from './exports';
export * from './type';

// oxlint-disable-next-line typescript/no-explicit-any
type OneArgumentStateClosureClass = StateClosureClass<any, [any]>;

// oxlint-disable-next-line typescript/no-explicit-any
type AnyMappingFunction = (params: any) => any;

type RuntimeSlottedDescriptor = readonly [
  OneArgumentStateClosureClass | AnyMappingFunction,
  unknown,
  unknown?,
];

/** Marks a value to bypass descriptor resolution. */
export const D = <T>(value: T): ImmediateDescriptor<T> => {
  return { [immediateDescriptor]: value } as unknown as ImmediateDescriptor<T>;
};

/** Types a descriptor and returns it unchanged. */
export function S<
  const C extends OneArgumentStateClosureClass,
  const P extends Descriptor<ConstructorParameters<C>[0]>,
>(descriptor: readonly [C, P]): SlottedDescriptor<C, P>;
export function S<const D extends MappingDescriptorNode, R>(
  descriptor: readonly [unknown, D, unknown] &
    readonly [(params: MappingDescriptorValue<D>) => R, unknown, Distinctor<NoInfer<R>>],
): readonly [(params: MappingDescriptorValue<D>) => R, D, Distinctor<R>];
export function S<const D extends MappingDescriptorNode, R>(
  descriptor: readonly [unknown, D] & readonly [(params: MappingDescriptorValue<D>) => R, unknown],
): MappedSlottedDescriptor<(params: MappingDescriptorValue<D>) => R, D>;
export function S<T>(descriptor: JSXDescriptor<T>): JSXDescriptor<T>;
export function S(
  descriptor: RuntimeSlottedDescriptor | JSXDescriptor<unknown>,
): RuntimeSlottedDescriptor | JSXDescriptor<unknown> {
  return descriptor;
}

/** Builds the root state closure described by a descriptor tree. */
export function buildDescriptor<const D extends StateClosureDescriptor<unknown>>(
  descriptor: D,
): BuiltStateClosure<D>;
export function buildDescriptor<T>(descriptor: StateClosureDescriptor<T>): IStateClosure<T>;
export function buildDescriptor(
  descriptor: StateClosureDescriptor<unknown>,
): IStateClosure<unknown> {
  const scope = createDescriptorScope();

  try {
    return buildStateClosure(descriptor, scope, true);
  } catch (error) {
    destroyDescriptorScope(scope);

    throw error;
  }
}

export const createSlottedDescriptor = S;

export const createStateClosureByDescriptor = <const D extends StateClosureDescriptor<unknown>>({
  descriptor,
}: {
  descriptor: D;
}): BuiltStateClosure<D> => buildDescriptor(descriptor);
