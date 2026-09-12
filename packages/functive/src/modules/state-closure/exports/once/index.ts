import { isFunction } from 'lodash-es';

import type { StateClosureResultNode } from '../render';

// oxlint-disable-next-line typescript/no-explicit-any
type StateFactory = (inputs: any) => StateClosureResultNode;

const onceFunction = /*#__PURE__*/ Symbol('onceFunction');

export type OnceFunctionMetadata = {
  readonly [onceFunction]: true;
};

export type OnceFunction<F extends StateFactory = StateFactory> = F & OnceFunctionMetadata;

export type AnyOnceFunction = OnceFunction;

/** Declares a function that builds its state flow once, on the first value access. */
export const once = <F extends StateFactory>(factory: F): OnceFunction<F> => {
  return new Proxy(factory, {
    get(target, key, receiver) {
      return key === onceFunction ? true : Reflect.get(target, key, receiver);
    },
  }) as OnceFunction<F>;
};

export const isOnceFunction = (factory: unknown): factory is AnyOnceFunction => {
  return isFunction(factory) && Reflect.get(factory, onceFunction) === true;
};
