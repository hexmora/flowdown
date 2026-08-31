// oxlint-disable typescript/no-explicit-any
import { isObjectLike } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { Distinctor } from '../../reactive-state';

type ShallowComparable = Record<string, unknown> | unknown[];

type StateMapper = (props: any) => any;

const MemoedMapperKey: unique symbol = /*#__PURE__*/ Symbol('MemoedMapper');

const isShallowEqual = <T>(left: T, right: T): boolean => {
  if (Object.is(left, right)) {
    return true;
  }

  if (!isObjectLike(left) || !isObjectLike(right)) {
    return false;
  }

  return shallowEqual(left as ShallowComparable, right as ShallowComparable);
};

export type MemoizedStateMapper<M extends StateMapper = StateMapper> = M & {
  readonly [MemoedMapperKey]: unknown;
};

export type AnyMemoizedStateMapper = MemoizedStateMapper;

/** Creates a JSX-compatible state mapper with shallow output equality by default. */
export const memo = <M extends StateMapper>(
  mapper: M,
  distinctor: Distinctor<ReturnType<M>> = isShallowEqual,
): MemoizedStateMapper<M> => {
  const wrapped = ((props: Parameters<M>[0]) => mapper(props)) as MemoizedStateMapper<M>;

  Object.defineProperty(wrapped, MemoedMapperKey, { value: distinctor });

  return wrapped;
};

export const getMemoedDistinctor = (mapper: unknown): Distinctor<unknown> | undefined => {
  if (typeof mapper !== 'function' || !(MemoedMapperKey in mapper)) {
    return undefined;
  }

  return (mapper as unknown as Record<PropertyKey, unknown>)[
    MemoedMapperKey
  ] as Distinctor<unknown>;
};
