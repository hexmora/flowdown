import type { Distinctor } from '../../modules/reactive-state';
import type { IStateClosure } from '../../modules/state-closure';
import type { AnyImmediateStateMapper, ImmediateStateMapperMetadata } from '../immediate';
import type {
  BuiltStateClosure,
  ComparedMappedSlottedDescriptor,
  Descriptor,
  FunctionalStateMapperValue,
  ImmediateDescriptor,
  JSXDescriptor,
  MappedSlottedDescriptor,
  MappingDescriptorNode,
  MappingDescriptorValue,
  SlottedDescriptor,
  StateClosureClass,
  StateClosureDescriptor,
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

type NonImmediateMappingFunction = AnyMappingFunction & {
  [K in keyof ImmediateStateMapperMetadata]?: never;
};

type ImmediateStateMapperInput<M extends AnyImmediateStateMapper> =
  Parameters<M> extends [] ? {} : Parameters<M>[0];

type ImmediateDescriptorInputs<P> = P extends object
  ? { [K in keyof P]: ImmediateDescriptor<P[K]> }
  : never;

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
export function S<
  const M extends AnyImmediateStateMapper,
  const P extends ImmediateDescriptorInputs<ImmediateStateMapperInput<M>>,
  R,
  const C extends Distinctor<NoInfer<FunctionalStateMapperValue<R>>>,
>(
  descriptor: readonly [M, P, C] &
    readonly [(params: MappingDescriptorValue<P>) => R, unknown, unknown],
): ComparedMappedSlottedDescriptor<M, P, C, FunctionalStateMapperValue<R>>;
export function S<
  const M extends AnyImmediateStateMapper,
  const P extends ImmediateDescriptorInputs<ImmediateStateMapperInput<M>>,
  R,
>(
  descriptor: readonly [M, P] & readonly [(params: MappingDescriptorValue<P>) => R, unknown],
): MappedSlottedDescriptor<M, P, FunctionalStateMapperValue<R>>;
export function S<
  const D extends MappingDescriptorNode,
  R,
  const M extends NonImmediateMappingFunction,
  const C extends Distinctor<NoInfer<FunctionalStateMapperValue<R>>>,
>(
  descriptor: readonly [M, D, C] &
    readonly [(params: MappingDescriptorValue<D>) => R, unknown, unknown],
): ComparedMappedSlottedDescriptor<M, D, C, FunctionalStateMapperValue<R>>;
export function S<
  const D extends MappingDescriptorNode,
  R,
  const M extends NonImmediateMappingFunction,
>(
  descriptor: readonly [M, D] & readonly [(params: MappingDescriptorValue<D>) => R, unknown],
): MappedSlottedDescriptor<M, D, FunctionalStateMapperValue<R>>;
export function S<T>(descriptor: JSXDescriptor<T>): JSXDescriptor<T>;
export function S(descriptor: RuntimeSlottedDescriptor | JSXDescriptor<unknown>): unknown {
  return markStateClosureDescriptor(descriptor);
}

/** Renders a descriptor tree into its root state closure. */
export function render<const D extends StateClosureDescriptor<unknown>>(
  descriptor: D,
): BuiltStateClosure<D>;
export function render<T>(descriptor: StateClosureDescriptor<T>): IStateClosure<T>;
export function render(descriptor: StateClosureDescriptor<unknown>): IStateClosure<unknown> {
  const scope = createDescriptorScope();

  try {
    return buildStateClosure(descriptor, scope, true);
  } catch (error) {
    destroyDescriptorScope(scope);

    throw error;
  }
}
