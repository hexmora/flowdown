import { type IPluggable, type IPluginWithConfig, PluginPriority } from '@flowdown/types';
import { assert } from '@flowdown/utils';
import {
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

const isPluginConfigEqual = (left: unknown, right: unknown) => {
  return isEqualWith(left, right, (leftValue, rightValue) => {
    if (isOpaqueConfigValue(leftValue) || isOpaqueConfigValue(rightValue)) {
      return leftValue === rightValue;
    }

    return undefined;
  });
};

export const isPluggableEqual = <T extends IPluginWithConfig>(
  left: IPluggable<T, unknown>,
  right: IPluggable<T, unknown>,
): boolean => {
  const [leftClass, leftConfig] = isArray(left) ? left : [left, undefined];

  const [rightClass, rightConfig] = isArray(right) ? right : [right, undefined];

  return leftClass === rightClass && isPluginConfigEqual(leftConfig, rightConfig);
};

export const isPluggablesEqual = <T extends IPluginWithConfig>(
  left: readonly IPluggable<T, unknown>[],
  right: readonly IPluggable<T, unknown>[],
): boolean => {
  return (
    left.length === right.length &&
    left.every((item, index) => isPluggableEqual(item, right[index]))
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
