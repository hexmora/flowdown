import type { IReadableClosure, StateClosureDirectSource, StateClosureSource } from './type';

import { isReactiveStateLike } from '../reactive-state';
import {
  isImmediateDescriptor,
  isReadableClosure,
  isStateClosureDescriptor,
  render,
  unwrapImmediateDescriptor,
} from './exports/render';

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

  readonly source: IReadableClosure<T>;
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

  if (isReadableClosure<T>(source)) {
    return { type: 'closure', source };
  }

  if (source !== null && isStateClosureDescriptor<T>(source)) {
    return {
      type: 'closure',
      source: render<T>(source),
    };
  }

  return { type: 'direct', source: source as StateClosureDirectSource<T> };
};
