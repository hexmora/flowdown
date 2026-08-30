// oxlint-disable typescript/no-explicit-any
import { isObjectLike } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { Distinctor } from '../reactive-state';

type ShallowComparable = Record<string, unknown> | unknown[];

type StateMapper = (props: any) => any;

const memoizedStateMapper: unique symbol = /*#__PURE__*/ Symbol.for(
  '@flowdown/reactive/MemoizedStateMapper',
) as any;

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
  readonly [memoizedStateMapper]: unknown;
};

export type AnyMemoizedStateMapper = MemoizedStateMapper;

/** Creates a JSX-compatible state mapper with shallow output equality by default. */
export const memo = <M extends StateMapper>(
  mapper: M,
  distinctor: Distinctor<ReturnType<M>> = isShallowEqual,
): MemoizedStateMapper<M> => {
  const wrapped = ((props: Parameters<M>[0]) => mapper(props)) as MemoizedStateMapper<M>;

  Object.defineProperty(wrapped, memoizedStateMapper, { value: distinctor });

  return wrapped;
};

export const getMemoizedStateMapperDistinctor = (
  mapper: unknown,
): Distinctor<unknown> | undefined => {
  if (typeof mapper !== 'function' || !(memoizedStateMapper in mapper)) {
    return undefined;
  }

  return (mapper as unknown as Record<PropertyKey, unknown>)[
    memoizedStateMapper
  ] as Distinctor<unknown>;
};
