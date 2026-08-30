// oxlint-disable typescript/no-explicit-any
import type { Newable } from '../../typings';
import type { Distinctor, IReactiveState } from '../reactive-state';
import type { IStateClosure } from '../state-closure';

declare const immediateDescriptor: unique symbol;

declare const jsxDescriptor: unique symbol;

export type StateClosureClass<T, P extends unknown[] = []> = Newable<IStateClosure<T>, P>;

export type ImmediateDescriptor<T> = {
  readonly [immediateDescriptor]: T;
};

/** Describes a state closure emitted by the JSX runtime. */
export type JSXDescriptor<T = unknown> = {
  readonly [jsxDescriptor]: T;
};

type AnyStateClosureClass = StateClosureClass<any, any[]>;

type ZeroArgumentStateClosureClass = StateClosureClass<any>;

type OneArgumentStateClosureClass = StateClosureClass<any, [any]>;

type AnyMappingFunction = (params: any) => any;

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

type LooseMappedSlottedDescriptor<T> =
  | readonly [(params: any) => T, MappingDescriptorNode]
  | readonly [(params: any) => T, MappingDescriptorNode, Distinctor<any>];

/** Describes how to obtain a state closure without resolving its value. */
export type StateClosureDescriptor<T> =
  | IStateClosure<T>
  | StateClosureClass<T>
  | LooseSlottedDescriptor<T>
  | LooseMappedSlottedDescriptor<T>
  | JSXDescriptor<T>;

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
> = readonly [C, D];

export type MappingDescriptorNode =
  | ImmediateDescriptor<any>
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
    : D extends JSXDescriptor<infer T>
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
                  ? ReturnType<C>
                  : { [K in keyof D]: MappingDescriptorValue<D[K]> }
              : D extends readonly unknown[]
                ? { [K in keyof D]: MappingDescriptorValue<D[K]> }
                : D extends object
                  ? { [K in keyof D]: MappingDescriptorValue<D[K]> }
                  : D;

export type MappedSlottedDescriptor<M, D> = readonly [M, D];

export type BuiltStateClosure<D> =
  D extends IStateClosure<any>
    ? D
    : D extends AnyStateClosureClass
      ? InstanceType<D>
      : D extends readonly [infer C, unknown, ...unknown[]]
        ? C extends AnyStateClosureClass
          ? InstanceType<C>
          : C extends AnyMappingFunction
            ? IStateClosure<ReturnType<C>>
            : never
        : D extends JSXDescriptor<infer T>
          ? IStateClosure<T>
          : never;
