// oxlint-disable typescript/no-explicit-any
import type { BehaviorSubject } from 'rxjs';

import type { Newable } from '../../../../../typings';
import type { Distinctor, IReactiveState } from '../../../../reactive-state';
import type { IReadableClosure } from '../../../type';
import type { AnyOnceFunction, OnceFunctionMetadata } from '../../once';

import { immediateDescriptor } from './consts';

declare const jsxDescriptor: unique symbol;

declare const markedStateClosureDescriptor: unique symbol;

export type StateClosureClass<T, P extends unknown[] = []> = Newable<IReadableClosure<T>, P>;

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

export type RuntimeSlottedDescriptor = readonly [
  AnyStateClosureClass | AnyMappingFunction,
  unknown,
  Distinctor<unknown>?,
];

export type ResolvedMappingNode =
  | { readonly type: 'constant'; readonly value: unknown }
  | { readonly type: 'state'; readonly closure: IReadableClosure<unknown> }
  | { readonly type: 'array'; readonly items: ResolvedMappingNode[] }
  | { readonly type: 'object'; readonly props: Record<string, ResolvedMappingNode> };

type LooseSlottedDescriptor<T> = readonly [StateClosureClass<T, [any]>, unknown];

type MapperFunction<T> = ((params: any) => T) & {
  readonly [K in keyof OnceFunctionMetadata]?: never;
};

type LooseMappedSlottedDescriptor<T> =
  | readonly [MapperFunction<T>, MappingDescriptorNode]
  | readonly [MapperFunction<T>, MappingDescriptorNode, Distinctor<any>];

type LooseOnceSlottedDescriptor<T> = readonly [
  ((
    params: any,
  ) => IReactiveState<T> | ReadableClosureDescriptor<T> | (null extends T ? null : never)) &
    OnceFunctionMetadata,
  unknown,
];

type ReadableClosureDescriptor<T> =
  | IReadableClosure<T>
  | StateClosureClass<T>
  | MarkedStateClosureDescriptor<T>;

/** Describes how to build a readable closure without accessing its value. */
export type StateClosureDescriptor<T> =
  | (null extends T ? null : never)
  | ReadableClosureDescriptor<T>
  | LooseSlottedDescriptor<T>
  | LooseOnceSlottedDescriptor<T>
  | LooseMappedSlottedDescriptor<T>;

/** A once function or class render method constructs a state flow. */
export type StateClosureResult<T> = IReactiveState<T> | StateClosureDescriptor<T>;

export type StateClosureResultValue<S> = S extends null
  ? null
  : S extends IReactiveState<infer T>
    ? T
    : S extends IReadableClosure<infer T>
      ? T
      : S extends MarkedStateClosureDescriptor<infer T>
        ? T
        : S extends StateClosureClass<infer T, any[]>
          ? T
          : S extends readonly [infer C, unknown, ...unknown[]]
            ? C extends StateClosureClass<infer T, any[]>
              ? T
              : C extends AnyMappingFunction
                ? FunctionalStateClosureValue<C>
                : never
            : never;

export type FunctionalStateClosureValue<M extends AnyMappingFunction> = M extends AnyOnceFunction
  ? StateClosureResultValue<ReturnType<M>>
  : ReturnType<M>;

type DirectClosureValue<T> = unknown extends T
  ? never
  : T extends
        | BehaviorSubject<any>
        | IReactiveState<any>
        | IReadableClosure<any>
        | ImmediateDescriptor<any>
        | MarkedStateClosureDescriptor<any>
        | ((...params: any[]) => unknown)
        | (abstract new (...params: any[]) => unknown)
    ? never
    : object extends T
      ? never
      : T;

/** Nested descriptor tuples are marked with S or JSX so ordinary arrays remain values. */
export type ReadableClosureSource<T> =
  | DirectClosureValue<T>
  | BehaviorSubject<T>
  | IReactiveState<T>
  | ReadableClosureDescriptor<T>;

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type ReadableClosureInput<T, V> =
  IReadableClosure<V> extends T ? Exclude<ReadableClosureSource<V>, Primitive> : T;

type ClosureFactoryResult<T, V> = IReadableClosure<V> extends T ? ReadableClosureSource<V> : T;

type IsClosureFactory<P extends unknown[], R> = [R] extends [IReadableClosure<unknown>]
  ? P extends []
    ? true
    : P extends [object?]
      ? Exclude<P[0], undefined> extends readonly unknown[] | ((...params: any[]) => unknown)
        ? false
        : true
      : false
  : false;

type StaticClosureInput<T> =
  T extends IReadableClosure<unknown>
    ? never
    : T extends (...params: infer P) => infer R
      ? IsClosureFactory<P, R> extends true
        ? never
        : T
      : T;

/** Primitives are static; other static values use D; readable inputs and factories are owned. */
export type StateClosureInputSlot<T> =
  | (T extends IReadableClosure<infer V>
      ? ReadableClosureInput<T, V>
      : T extends (...params: infer P) => infer R
        ? IsClosureFactory<P, R> extends true
          ? (...params: P) => ClosureFactoryResult<R, StateClosureResultValue<R>>
          : never
        : never)
  | (StaticClosureInput<T> & Primitive)
  | ImmediateDescriptor<StaticClosureInput<T>>;

export type StateClosureInputProps<P extends object> = {
  [K in keyof P]: StateClosureInputSlot<P[K]>;
};

export type StateClosureInputDescriptor<P> = P extends
  | IReadableClosure<unknown>
  | readonly unknown[]
  | ((...params: any[]) => unknown)
  ? StateClosureInputSlot<P>
  : P extends object
    ? StateClosureInputProps<P>
    : StateClosureInputSlot<P>;

type ReadableSourceValue<S> =
  S extends BehaviorSubject<infer T>
    ? T
    : S extends IReactiveState<infer T>
      ? T
      : S extends IReadableClosure<infer T> | MarkedStateClosureDescriptor<infer T>
        ? T
        : S extends StateClosureClass<infer T>
          ? T
          : S;

export type StateClosureInputSlotValue<D> =
  D extends ImmediateDescriptor<infer T>
    ? T
    : D extends Primitive
      ? D
      : D extends IReadableClosure<unknown>
        ? D
        : D extends (...params: infer P) => infer R
          ? (...params: P) => IReadableClosure<ReadableSourceValue<R>>
          : IReadableClosure<ReadableSourceValue<D>>;

export type StateClosureInputValue<D> = D extends
  | ImmediateDescriptor<unknown>
  | IReactiveState<unknown>
  | IReadableClosure<unknown>
  | StateClosureDescriptor<unknown>
  | readonly unknown[]
  | ((...params: any[]) => unknown)
  ? StateClosureInputSlotValue<D>
  : D extends object
    ? { [K in keyof D]: StateClosureInputSlotValue<D[K]> }
    : StateClosureInputSlotValue<D>;

export type SlottedDescriptor<
  C extends OneArgumentStateClosureClass,
  D extends StateClosureInputDescriptor<ConstructorParameters<C>[0]> = StateClosureInputDescriptor<
    ConstructorParameters<C>[0]
  >,
> = readonly [C, D] &
  MarkedStateClosureDescriptor<C extends StateClosureClass<infer T, any[]> ? T : never>;

/** Mapper inputs recursively resolve source values while D preserves a value as-is. */
export type Descriptor<T> =
  | ImmediateDescriptor<T>
  | BehaviorSubject<T>
  | IReactiveState<T>
  | ReadableClosureDescriptor<T>
  | (T extends (...params: any[]) => unknown
      ? never
      : T extends readonly unknown[]
        ? { [K in keyof T]: Descriptor<T[K]> }
        : T extends object
          ? { [K in keyof T]: Descriptor<T[K]> }
          : T);

export type MappingDescriptorNode =
  | ImmediateDescriptor<any>
  | MarkedStateClosureDescriptor<any>
  | BehaviorSubject<any>
  | IReactiveState<any>
  | IReadableClosure<any>
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | ZeroArgumentStateClosureClass
  | readonly MappingDescriptorNode[]
  | { readonly [key: string]: MappingDescriptorNode };

export type MappingDescriptorValue<D> =
  D extends ImmediateDescriptor<infer T>
    ? T
    : D extends MarkedStateClosureDescriptor<infer T>
      ? T
      : D extends BehaviorSubject<infer T>
        ? T
        : D extends IReactiveState<infer T>
          ? T
          : D extends IReadableClosure<infer T>
            ? T
            : D extends StateClosureClass<infer T, any[]>
              ? T
              : D extends readonly unknown[]
                ? { [K in keyof D]: MappingDescriptorValue<D[K]> }
                : D extends object
                  ? { [K in keyof D]: MappingDescriptorValue<D[K]> }
                  : D;

export type MappedSlottedDescriptor<M, D, T> = readonly [M, D] & MarkedStateClosureDescriptor<T>;

export type ComparedMappedSlottedDescriptor<M, D, C, T> = readonly [M, D, C] &
  MarkedStateClosureDescriptor<T>;

export type BuiltClosure<D> = D extends null
  ? IReadableClosure<null>
  : D extends IReadableClosure<any>
    ? D
    : D extends AnyStateClosureClass
      ? InstanceType<D>
      : D extends readonly [infer C, unknown, ...unknown[]]
        ? C extends AnyStateClosureClass
          ? InstanceType<C>
          : D extends MarkedStateClosureDescriptor<infer T>
            ? IReadableClosure<T>
            : C extends AnyMappingFunction
              ? IReadableClosure<FunctionalStateClosureValue<C>>
              : never
        : D extends MarkedStateClosureDescriptor<infer T>
          ? IReadableClosure<T>
          : never;
