import { type IPluggable, type IPluginWithConfig, PluginPriority } from '@flowdown/types';
import { assert } from '@flowdown/utils';
import {
  every,
  first,
  isArray,
  isEqualWith,
  isFunction,
  isObject,
  isPlainObject,
  sortBy,
} from 'lodash-es';

const isOpaqueConfigValue = (value: unknown) => {
  return (
    isObject(value) &&
    ((!isArray(value) && !isPlainObject(value)) ||
      ('destroy' in value && isFunction(value.destroy)) ||
      ('subscribe' in value && isFunction(value.subscribe)))
  );
};

export const isPluginConfigEqual = (left: unknown, right: unknown) => {
  return isEqualWith(left, right, (leftValue, rightValue) => {
    if (isOpaqueConfigValue(leftValue) || isOpaqueConfigValue(rightValue)) {
      return leftValue === rightValue;
    }

    return undefined;
  });
};

export const isPluggableEqual = <T>(left: T | [T, unknown], right: T | [T, unknown]): boolean => {
  return (
    left === right ||
    ((isArray(left) ? left[0] : left) === (isArray(right) ? right[0] : right) &&
      isPluginConfigEqual(
        isArray(left) ? left[1] : undefined,
        isArray(right) ? right[1] : undefined,
      ))
  );
};

export const isPluggablesEqual = <T>(
  left: readonly T[] = [],
  right: readonly T[] = [],
): boolean => {
  return (
    left === right ||
    (left.length === right.length &&
      every(left, (pluggable, index) => {
        const other = right[index];

        return pluggable !== undefined && other !== undefined && isPluggableEqual(pluggable, other);
      }))
  );
};

export function buildPluggables<T extends IPluginWithConfig>(): T[];

export function buildPluggables<T extends IPluginWithConfig>(pluggable: IPluggable<T, unknown>): T;

export function buildPluggables<T extends IPluginWithConfig>(
  first: IPluggable<T, unknown>,
  second: IPluggable<T, unknown>,
  ...rest: IPluggable<T, unknown>[]
): T[];

export function buildPluggables<T extends IPluginWithConfig>(
  ...pluggables: IPluggable<T, unknown>[]
): T | T[];

export function buildPluggables<T extends IPluginWithConfig>(
  ...pluggables: IPluggable<T, unknown>[]
): T | T[] {
  const instances = pluggables.map((item) => {
    if (isArray(item)) {
      const [clazz, config] = item;

      return new clazz(config);
    }

    return new item();
  });

  if (instances.length !== 1) {
    return instances;
  }

  const instance = first(instances);

  assert(instance, 'A single pluggable must produce one plugin instance.');

  return instance;
}

export const sortPluginInstances = <T extends IPluginWithConfig>(instances: T[]) => {
  return sortBy(instances, (item) => item.config.priority ?? PluginPriority.Default);
};
