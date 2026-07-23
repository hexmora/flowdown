import { isFunction } from 'lodash-es';

import type { BaseStateClosureSource } from './type';

import { isReactiveStateLike } from '../reactive-state';

export const extractRawSource = <T>(source: BaseStateClosureSource<T>) => {
  if (!isReactiveStateLike(source) && isFunction(source)) {
    return source();
  }

  return source;
};
