// oxlint-disable typescript/no-explicit-any
import type { JSXDescriptor, StateClosureClass } from './modules/descriptor';
import type { AnyMemoizedStateMapper } from './modules/descriptor/memo';

import { Fragment, jsx } from './jsx-runtime';

export { Fragment } from './jsx-runtime';
export type { JSX } from './jsx-runtime';

type JSXSource = {
  readonly columnNumber?: number;

  readonly fileName?: string;

  readonly lineNumber?: number;
};

type JSXFactory = StateClosureClass<any, any[]> | AnyMemoizedStateMapper;

const runtimeJSX = jsx as unknown as (
  Factory: JSXFactory | typeof Fragment,
  props: Readonly<Record<string, unknown>>,
  key?: unknown,
) => JSXDescriptor<any>;

export const jsxDEV = (
  Factory: JSXFactory | typeof Fragment,
  props: Readonly<Record<string, unknown>>,
  key: unknown,
  _isStaticChildren: boolean,
  _source?: JSXSource,
  _self?: unknown,
): JSXDescriptor<any> => {
  return runtimeJSX(Factory, props, key);
};
