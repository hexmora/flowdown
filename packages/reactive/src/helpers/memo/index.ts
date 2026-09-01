// oxlint-disable typescript/no-explicit-any
import { isObjectLike } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { Distinctor } from '../../modules/reactive-state';
import type { FunctionalStateMapperValue } from '../render';

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

const createMemoizedStateMapper = <M extends StateMapper>(
  mapper: M,
  distinctor: Distinctor<FunctionalStateMapperValue<ReturnType<M>>> = isShallowEqual,
): MemoizedStateMapper<M> => {
  const wrapped = ((props: Parameters<M>[0]) => mapper(props)) as MemoizedStateMapper<M>;

  Object.defineProperty(wrapped, MemoedMapperKey, { value: distinctor });

  return wrapped;
};

/** Creates a state mapper with shallow output equality by default. */
export const memo = createMemoizedStateMapper;

export const getMemoedDistinctor = (mapper: unknown): Distinctor<unknown> | undefined => {
  if (typeof mapper !== 'function' || !(MemoedMapperKey in mapper)) {
    return undefined;
  }

  return (mapper as unknown as Record<PropertyKey, unknown>)[
    MemoedMapperKey
  ] as Distinctor<unknown>;
};
