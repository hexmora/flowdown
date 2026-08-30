// oxlint-disable typescript/no-explicit-any
import type { JSXDescriptor, StateClosureClass } from './modules/descriptor';

import { Fragment, jsx } from './jsx-runtime';

export { Fragment } from './jsx-runtime';
export type { JSX } from './jsx-runtime';

type JSXSource = {
  readonly columnNumber?: number;

  readonly fileName?: string;

  readonly lineNumber?: number;
};

const runtimeJSX = jsx as unknown as (
  Factory: StateClosureClass<any, any[]> | typeof Fragment,
  props: Readonly<Record<string, unknown>>,
  key?: unknown,
) => JSXDescriptor<any>;

export const jsxDEV = (
  Factory: StateClosureClass<any, any[]> | typeof Fragment,
  props: Readonly<Record<string, unknown>>,
  key: unknown,
  _isStaticChildren: boolean,
  _source?: JSXSource,
  _self?: unknown,
): JSXDescriptor<any> => {
  return runtimeJSX(Factory, props, key);
};
