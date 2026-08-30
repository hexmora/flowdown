import type { IStateClosure, StateClosureDirectSource, StateClosureSource } from './type';

import { buildDescriptor } from '../descriptor';
import {
  isImmediateDescriptor,
  isStateClosure,
  isStateClosureDescriptor,
  unwrapImmediateDescriptor,
} from '../descriptor/utils/resolve';
import { isReactiveStateLike } from '../reactive-state';

export type ResolvedDirectSource<T> = {
  readonly type: 'direct';

  readonly source: StateClosureDirectSource<T>;
};

export type ResolvedImmediateSource<T> = {
  readonly type: 'immediate';

  readonly source: T;
};

export type ResolvedClosureSource<T> = {
  readonly type: 'closure';

  readonly source: IStateClosure<T>;

  readonly owned: boolean;
};

export type ResolvedStateClosureSource<T> =
  | ResolvedDirectSource<T>
  | ResolvedImmediateSource<T>
  | ResolvedClosureSource<T>;

export const isResolvedImmediateSource = <T>(
  source: ResolvedStateClosureSource<T>,
): source is ResolvedImmediateSource<T> => source.type === 'immediate';

export const isResolvedClosureSource = <T>(
  source: ResolvedStateClosureSource<T>,
): source is ResolvedClosureSource<T> => source.type === 'closure';

export const resolveSource = <T>(source: StateClosureSource<T>): ResolvedStateClosureSource<T> => {
  if (isImmediateDescriptor<T>(source)) {
    return { type: 'immediate', source: unwrapImmediateDescriptor(source) };
  }

  if (isReactiveStateLike<T>(source)) {
    return { type: 'direct', source };
  }

  if (isStateClosure<T>(source)) {
    return { type: 'closure', source, owned: false };
  }

  if (isStateClosureDescriptor<T>(source)) {
    return {
      type: 'closure',
      source: buildDescriptor(source),
      owned: true,
    };
  }

  return { type: 'direct', source: source as StateClosureDirectSource<T> };
};
