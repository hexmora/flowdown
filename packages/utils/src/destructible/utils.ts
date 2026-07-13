import { isFunction, isObject } from 'lodash-es';

import type { IDestructible } from './type';

export const isDestructible = (value: unknown): value is IDestructible => {
  return isObject(value) && 'destroy' in value && isFunction(value.destroy);
};
