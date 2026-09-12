import { isFunction, isObject } from 'lodash-es';
import { Subject } from 'rxjs';

import type { DestructibleTarget, IDestructible } from './type';

const isDestructible = (value: unknown): value is IDestructible => {
  return isObject(value) && 'destroy' in value && isFunction(value.destroy);
};

export const clearByTarget = (target: DestructibleTarget) => {
  if (target instanceof Subject) {
    target.complete();

    return;
  }

  if (isDestructible(target)) {
    target.destroy();

    return;
  }

  if (isFunction(target)) {
    target();

    return;
  }

  target.unsubscribe();
};
