// oxlint-disable typescript/no-explicit-any
import { isFunction, isObjectLike } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { Distinctor } from '../../../reactive-state';
import type { OnceFunctionMetadata } from '../once';

import { isClass } from '../../../../utils';
import { isOnceFunction } from '../once';

type StateMapper = ((props: any) => any) & {
  readonly [K in keyof OnceFunctionMetadata]?: never;
};

type ShallowComparable = Record<string, unknown> | unknown[];

export type StateMapperComparers<T = unknown, R = unknown> = {
  inputs?: Distinctor<T>;

  returns: Distinctor<R>;
};

const mapperComparers = /*#__PURE__*/ Symbol('mapperComparers');

export const isShallowEqual = <T>(left: T, right: T): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  return (
    isObjectLike(left) &&
    isObjectLike(right) &&
    shallowEqual(left as ShallowComparable, right as ShallowComparable)
  );
};

const withComparers = <M extends StateMapper>(
  mapper: M,
  comparers: StateMapperComparers<Parameters<M>[0], ReturnType<M>>,
): M => {
  if (isClass(mapper) || isOnceFunction(mapper)) {
    throw new TypeError('memo and memoReturns can only be used with mapper functions.');
  }

  return new Proxy(mapper, {
    get(target, key, receiver) {
      return key === mapperComparers ? comparers : Reflect.get(target, key, receiver);
    },
  });
};

/** Skips equal mapper inputs and filters equal return values, per rendered closure. */
export const memo = <M extends StateMapper>(
  mapper: M,
  inputs: Distinctor<Parameters<M>[0]> = isShallowEqual,
  returns: Distinctor<ReturnType<M>> = Object.is,
): M => withComparers(mapper, { inputs, returns });

/** Filters return values without skipping mapper calls. */
export const memoReturns = <M extends StateMapper>(
  mapper: M,
  returns: Distinctor<ReturnType<M>> = Object.is,
): M => withComparers(mapper, { returns });

export const getMapperComparers = (mapper: unknown): StateMapperComparers | undefined => {
  return isFunction(mapper) ? Reflect.get(mapper, mapperComparers) : undefined;
};
