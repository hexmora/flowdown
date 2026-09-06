// oxlint-disable typescript/no-explicit-any
import type { IReadableClosure } from './modules/state-closure';
import type { AnyOnceFunction } from './modules/state-closure/exports/once';
import type {
  Descriptor,
  FunctionalStateClosureValue,
  JSXDescriptor,
  StateClosureClass,
  StateClosureInputProps,
} from './modules/state-closure/exports/render';

import { markStateClosureDescriptor } from './modules/state-closure/exports/render';

type AnyStateClosureClass = StateClosureClass<any, any[]>;

type JSXStateClosureClass = StateClosureClass<any> | StateClosureClass<any, [any]>;

type AnyStateMapper = (inputs: any) => any;

type JSXElementType = JSXStateClosureClass | AnyStateMapper;

type RuntimeProps = Readonly<Record<string, unknown>>;

type EmptyJSXDescriptorProps = {
  readonly [key: string]: never;
};

type ObjectJSXDescriptorProps<P extends object> = keyof P extends never
  ? EmptyJSXDescriptorProps
  : StateClosureInputProps<P>;

type JSXDescriptorObjectProps<P> = [Exclude<P, undefined | void>] extends [never]
  ? EmptyJSXDescriptorProps
  : Exclude<P, undefined | void> extends infer O
    ? O extends readonly unknown[] | ((...params: any[]) => unknown)
      ? never
      : O extends object
        ? ObjectJSXDescriptorProps<O>
        : never
    : never;

type JSXDescriptorPropsFromParameters<P extends unknown[]> = P extends []
  ? EmptyJSXDescriptorProps
  : P extends [infer A, ...infer R]
    ? [] extends R
      ? JSXDescriptorObjectProps<A>
      : never
    : P extends [(infer A)?]
      ? JSXDescriptorObjectProps<A>
      : never;

type JSXStateClosureDescriptorAttributes<C, P> =
  JSXDescriptorObjectProps<P> extends never
    ? unknown extends P
      ? C extends StateClosureClass<any>
        ? EmptyJSXDescriptorProps
        : never
      : never
    : JSXDescriptorObjectProps<P>;

type JSXStateMapperAttributes<C, P> = C extends AnyStateMapper
  ? Parameters<C> extends []
    ? EmptyJSXDescriptorProps
    : C extends AnyOnceFunction
      ? JSXStateClosureInputProps<P>
      : JSXMappingDescriptorProps<P>
  : never;

type JSXDescriptorAttributes<C, P> = {
  closure: JSXStateClosureDescriptorAttributes<C, P>;
  mapper: JSXStateMapperAttributes<C, P>;
}[C extends AnyStateMapper ? 'mapper' : 'closure'];

type JSXDescriptorProps<C extends AnyStateClosureClass> = JSXDescriptorPropsFromParameters<
  ConstructorParameters<C>
>;

type StateClosureClassValue<C extends AnyStateClosureClass> =
  C extends StateClosureClass<infer T, any[]> ? T : never;

type JSXMappingDescriptorProps<P> = P extends object
  ? keyof P extends never
    ? EmptyJSXDescriptorProps
    : { [K in keyof P]: Descriptor<P[K]> }
  : never;

type JSXStateClosureInputProps<P> = P extends object
  ? keyof P extends never
    ? EmptyJSXDescriptorProps
    : StateClosureInputProps<P>
  : never;

type StateMapperInput<M extends AnyStateMapper> = Parameters<M> extends [] ? {} : Parameters<M>[0];

type StateMapperInputs<M extends AnyStateMapper> = M extends AnyOnceFunction
  ? JSXStateClosureInputProps<StateMapperInput<M>>
  : JSXMappingDescriptorProps<StateMapperInput<M>>;

type StateMapperValue<M extends AnyStateMapper> = FunctionalStateClosureValue<M>;

type JSXDescriptorKey<P> = P extends { readonly key?: infer K } ? K : never;

type JSXDescriptorArguments<P> =
  | [props: P]
  | ([JSXDescriptorKey<P>] extends [never]
      ? never
      : [props: Omit<P, 'key'>, key: JSXDescriptorKey<P>]);

export const Fragment = /*#__PURE__*/ Symbol('FlowdownDescriptorFragment');

type FragmentProps = {
  readonly children?: unknown;
};

const createDescriptorElement = (
  Factory: AnyStateClosureClass | AnyStateMapper | typeof Fragment,
  props: RuntimeProps | FragmentProps,
  key?: unknown,
): unknown => {
  if (Factory === Fragment) {
    throw new TypeError('Descriptor JSX fragments are not supported.');
  }

  const descriptorProps =
    key === undefined || Object.prototype.hasOwnProperty.call(props, 'key')
      ? props
      : { ...props, key };

  return markStateClosureDescriptor([Factory, descriptorProps]);
};

/**
 * Compatibility factory used when an automatic JSX transform falls back to
 * classic emission, such as when `key` appears after a spread attribute.
 */
export const createElement = (
  Factory: AnyStateClosureClass | AnyStateMapper | typeof Fragment,
  props: RuntimeProps | null,
  ...children: unknown[]
): JSXDescriptor<any> => {
  const { __self: _self, __source: _source, ...descriptorProps } = props ?? {};

  if (children.length === 0) {
    return createDescriptorElement(Factory, descriptorProps) as JSXDescriptor<any>;
  }

  return createDescriptorElement(Factory, {
    ...descriptorProps,
    children: children.length === 1 ? children[0] : children,
  }) as JSXDescriptor<any>;
};

/** Creates a state closure descriptor. Normally emitted by a JSX transform. */
export function jsx<const C extends AnyStateClosureClass>(
  Factory: C,
  ...args: JSXDescriptorArguments<JSXDescriptorProps<C>>
): JSXDescriptor<StateClosureClassValue<C>> & readonly [C, JSXDescriptorProps<C>];
export function jsx<const M extends AnyStateMapper>(
  Factory: M,
  ...args: JSXDescriptorArguments<StateMapperInputs<M>>
): JSXDescriptor<StateMapperValue<M>>;
export function jsx(Factory: typeof Fragment, props: FragmentProps): never;
export function jsx(
  Factory: AnyStateClosureClass | AnyStateMapper | typeof Fragment,
  props: RuntimeProps | FragmentProps,
  key?: unknown,
): JSXDescriptor<any> {
  return createDescriptorElement(Factory, props, key) as JSXDescriptor<any>;
}

export const jsxs = jsx;

export namespace JSX {
  export type Element = JSXDescriptor<any>;

  export type ElementType = JSXElementType;

  export interface ElementClass extends IReadableClosure<any> {}

  export interface ElementChildrenAttribute {
    children: unknown;
  }

  export interface IntrinsicAttributes {}

  export interface IntrinsicElements {}

  export type LibraryManagedAttributes<C, P> = JSXDescriptorAttributes<C, P>;
}
