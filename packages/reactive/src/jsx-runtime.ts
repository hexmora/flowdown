// oxlint-disable typescript/no-explicit-any
import type { Descriptor, JSXDescriptor, StateClosureClass } from './modules/descriptor';
import type { IStateClosure } from './modules/state-closure';

type AnyStateClosureClass = StateClosureClass<any, any[]>;

type JSXStateClosureClass = StateClosureClass<any> | StateClosureClass<any, [any]>;

type RuntimeProps = Readonly<Record<string, unknown>>;

type EmptyJSXDescriptorProps = {
  readonly [key: string]: never;
};

type ObjectJSXDescriptorProps<P extends object> = keyof P extends never
  ? EmptyJSXDescriptorProps
  : { [K in keyof P]: Descriptor<P[K]> };

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

type JSXDescriptorAttributes<C, P> =
  JSXDescriptorObjectProps<P> extends never
    ? unknown extends P
      ? C extends StateClosureClass<any>
        ? EmptyJSXDescriptorProps
        : never
      : never
    : JSXDescriptorObjectProps<P>;

type JSXDescriptorProps<C extends AnyStateClosureClass> = JSXDescriptorPropsFromParameters<
  ConstructorParameters<C>
>;

type StateClosureClassValue<C extends AnyStateClosureClass> =
  C extends StateClosureClass<infer T, any[]> ? T : never;

export const Fragment = Symbol('FlowdownDescriptorFragment');

type FragmentProps = {
  readonly children?: unknown;
};

const createDescriptorElement = (
  Factory: AnyStateClosureClass | typeof Fragment,
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

  return [Factory, descriptorProps];
};

/**
 * Compatibility factory used when an automatic JSX transform falls back to
 * classic emission, such as when `key` appears after a spread attribute.
 */
export const createElement = (
  Factory: AnyStateClosureClass | typeof Fragment,
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
  props: JSXDescriptorProps<C>,
  key?: unknown,
): JSXDescriptor<StateClosureClassValue<C>> & readonly [C, JSXDescriptorProps<C>];
export function jsx(Factory: typeof Fragment, props: FragmentProps, key?: unknown): never;
export function jsx(
  Factory: AnyStateClosureClass | typeof Fragment,
  props: RuntimeProps | FragmentProps,
  key?: unknown,
): JSXDescriptor<any> {
  return createDescriptorElement(Factory, props, key) as JSXDescriptor<any>;
}

export const jsxs = jsx;

export namespace JSX {
  export type Element = JSXDescriptor<any>;

  export type ElementType = JSXStateClosureClass;

  export interface ElementClass extends IStateClosure<any> {}

  export interface ElementChildrenAttribute {
    children: unknown;
  }

  export interface IntrinsicAttributes {}

  export interface IntrinsicElements {}

  export type LibraryManagedAttributes<C, P> = JSXDescriptorAttributes<C, P>;
}
