// oxlint-disable typescript/no-explicit-any
import type { Distinctor, IReactiveState } from '../../../modules/reactive-state';
import type { IStateClosure } from '../../../modules/state-closure';
import type { Newable } from '../../../typings';

import { immediateDescriptor as runtimeImmediateDescriptor } from './consts';

declare const immediateDescriptor: unique symbol;

declare const jsxDescriptor: unique symbol;

declare const markedStateClosureDescriptor: unique symbol;

export type StateClosureClass<T, P extends unknown[] = []> = Newable<IStateClosure<T>, P>;

export type ImmediateDescriptor<T> = {
  readonly [immediateDescriptor]: T;
};

export type MarkedStateClosureDescriptor<T> = {
  readonly [markedStateClosureDescriptor]: T;
};

/** Describes a state closure emitted by the JSX runtime. */
export type JSXDescriptor<T = unknown> = MarkedStateClosureDescriptor<T> & {
  readonly [jsxDescriptor]: T;
};

export type AnyStateClosureClass = StateClosureClass<any, any[]>;

type ZeroArgumentStateClosureClass = StateClosureClass<any>;

type OneArgumentStateClosureClass = StateClosureClass<any, [any]>;

export type AnyMappingFunction = (params: any) => any;

export type RuntimeImmediateDescriptor<T> = ImmediateDescriptor<T> & {
  readonly [runtimeImmediateDescriptor]: T;
};

export type RuntimeSlottedDescriptor = readonly [
  AnyStateClosureClass | AnyMappingFunction,
  unknown,
  Distinctor<unknown>?,
];

export type ResolvedMappingNode =
  | { readonly type: 'constant'; readonly value: unknown }
  | { readonly type: 'state'; readonly state: IReactiveState<unknown> }
  | readonly ResolvedMappingNode[]
  | { readonly [key: string]: ResolvedMappingNode };

/**
 * Keeps raw slotted tuples usable when S is omitted. S provides strict
 * constructor parameter inference.
 */
type AnyDescriptor =
  | ImmediateDescriptor<any>
  | IReactiveState<any>
  | StateClosureDescriptor<any>
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | readonly AnyDescriptor[]
  | { readonly [key: string]: AnyDescriptor }
  | ((...params: any[]) => AnyDescriptor);

type LooseSlottedDescriptor<T> = readonly [StateClosureClass<T, [any]>, unknown];

type FunctionalStateMapperSource<T> =
  | T
  | ImmediateDescriptor<T>
  | IReactiveState<T>
  | IStateClosure<T>
  | MarkedStateClosureDescriptor<T>
  | StateClosureClass<T>;

type LooseMappedSlottedDescriptor<T> =
  | readonly [(params: any) => FunctionalStateMapperSource<T>, MappingDescriptorNode]
  | readonly [
      (params: any) => FunctionalStateMapperSource<T>,
      MappingDescriptorNode,
      Distinctor<any>,
    ];

/** Describes how to obtain a state closure without resolving its value. */
export type StateClosureDescriptor<T> =
  | IStateClosure<T>
  | StateClosureClass<T>
  | LooseSlottedDescriptor<T>
  | LooseMappedSlottedDescriptor<T>
  | MarkedStateClosureDescriptor<T>
  | JSXDescriptor<T>;

/** Resolves the top-level value returned by a functional state mapper. */
export type FunctionalStateMapperValue<S> =
  S extends ImmediateDescriptor<infer T>
    ? T
    : S extends IReactiveState<infer T>
      ? T
      : S extends IStateClosure<infer T>
        ? T
        : S extends MarkedStateClosureDescriptor<infer T>
          ? T
          : S extends StateClosureClass<infer T, any[]>
            ? T
            : S;

export type DescriptorParameters<P extends unknown[]> = {
  [K in keyof P]: DescriptorParameter<P[K]>;
};

type StateResult<T> = T extends IReactiveState<infer V> ? V : never;

/** Describes a generator input as a recursive descriptor. */
export type DescriptorParameter<T> =
  T extends IReactiveState<infer _>
    ? T
    : T extends IStateClosure<infer V>
      ? IReactiveState<V>
      : T extends (...params: any[]) => unknown
        ? Descriptor<T>
        : T extends readonly unknown[]
          ? { [K in keyof T]: DescriptorParameter<T[K]> }
          : T extends object
            ? { [K in keyof T]: DescriptorParameter<T[K]> }
            : Descriptor<T>;

export type DescriptorGenerator<P extends unknown[], R> = (
  ...params: DescriptorParameters<P>
) => Descriptor<R>;

/** Describes a value that resolves to T inside state closure inputs. */
export type Descriptor<T> =
  | ImmediateDescriptor<T>
  | (T extends IReactiveState<any>
      ? IReactiveState<T['value']> | StateClosureDescriptor<T['value']>
      : T extends (...params: infer P) => infer R
        ? [StateResult<R>] extends [never]
          ? never
          : DescriptorGenerator<P, R>
        : T extends readonly unknown[]
          ? { [K in keyof T]: Descriptor<T[K]> }
          : T extends object
            ? { [K in keyof T]: Descriptor<T[K]> }
            : T);

export type SlottedDescriptor<
  C extends OneArgumentStateClosureClass,
  D extends Descriptor<ConstructorParameters<C>[0]> = Descriptor<ConstructorParameters<C>[0]>,
> = readonly [C, D] &
  MarkedStateClosureDescriptor<C extends StateClosureClass<infer T, any[]> ? T : never>;

export type MappingDescriptorNode =
  | ImmediateDescriptor<any>
  | MarkedStateClosureDescriptor<any>
  | JSXDescriptor<any>
  | IReactiveState<any>
  | IStateClosure<any>
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | ZeroArgumentStateClosureClass
  | readonly [OneArgumentStateClosureClass, AnyDescriptor]
  | readonly [AnyMappingFunction, MappingDescriptorNode]
  | readonly [AnyMappingFunction, MappingDescriptorNode, Distinctor<any>]
  | readonly MappingDescriptorNode[]
  | { readonly [key: string]: MappingDescriptorNode };

export type MappingDescriptorValue<D> =
  D extends ImmediateDescriptor<infer T>
    ? T
    : D extends MarkedStateClosureDescriptor<infer T>
      ? T
      : D extends IReactiveState<infer T>
        ? T
        : D extends IStateClosure<infer T>
          ? T
          : D extends StateClosureClass<infer T, any[]>
            ? T
            : D extends readonly [infer C, unknown, ...unknown[]]
              ? C extends StateClosureClass<infer T, any[]>
                ? T
                : C extends AnyMappingFunction
                  ? FunctionalStateMapperValue<ReturnType<C>>
                  : { [K in keyof D]: MappingDescriptorValue<D[K]> }
              : D extends readonly unknown[]
                ? { [K in keyof D]: MappingDescriptorValue<D[K]> }
                : D extends object
                  ? { [K in keyof D]: MappingDescriptorValue<D[K]> }
                  : D;

export type MappedSlottedDescriptor<M, D, T> = readonly [M, D] & MarkedStateClosureDescriptor<T>;

export type ComparedMappedSlottedDescriptor<M, D, C, T> = readonly [M, D, C] &
  MarkedStateClosureDescriptor<T>;

export type BuiltStateClosure<D> =
  D extends IStateClosure<any>
    ? D
    : D extends AnyStateClosureClass
      ? InstanceType<D>
      : D extends readonly [infer C, unknown, ...unknown[]]
        ? C extends AnyStateClosureClass
          ? InstanceType<C>
          : C extends AnyMappingFunction
            ? IStateClosure<FunctionalStateMapperValue<ReturnType<C>>>
            : never
        : D extends MarkedStateClosureDescriptor<infer T>
          ? IStateClosure<T>
          : never;
