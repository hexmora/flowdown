import {
  type IPluggable,
  type IPluginWithConfig,
  PluginPriority,
  type PluginSet,
} from '@flowdown/types';
import { assert } from '@flowdown/utils';
import {
  every,
  first,
  get,
  has,
  isArray,
  isEqualWith,
  isFunction,
  isObject,
  isObjectLike,
  isPlainObject,
  sortBy,
} from 'lodash-es';
import { isOnceFunction } from 'reactive';

import type { AnyPluggable, PluggableOf } from './type';

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

export const mergePluginPluggables = <T>(presets: readonly T[], extras: readonly T[]): T[] => {
  const pluggables = [...presets];

  for (const extra of extras) {
    const Plugin = isArray(extra) ? extra[0] : extra;

    const index = pluggables.findIndex((item) => (isArray(item) ? item[0] : item) === Plugin);

    if (index === -1) {
      pluggables.push(extra);

      continue;
    }

    pluggables[index] = extra;
  }

  return pluggables;
};

export const isPluginSetTuple = <T, C extends object>(
  pluginSet: PluginSet<T, C>,
): pluginSet is [T[], C] => {
  return (
    isArray(pluginSet) &&
    pluginSet.length === 2 &&
    isArray(pluginSet[0]) &&
    !isArray(pluginSet[1]) &&
    isObjectLike(pluginSet[1])
  );
};

export const isPluginSetEqual = <T, C extends object>(
  left: PluginSet<T, C>,
  right: PluginSet<T, C>,
): boolean => {
  return isPluginConfigEqual(left, right);
};

export function toPluggable<T extends AnyPluggable, C extends object>(
  pluginSet: PluginSet<T, C>,
  defaultPlugins?: readonly T[],
): PluggableOf<T>[];

export function toPluggable(
  pluginSet: PluginSet<AnyPluggable, object>,
  defaultPlugins: readonly AnyPluggable[] = [],
): AnyPluggable[] {
  const [plugins, configs] = isPluginSetTuple(pluginSet)
    ? pluginSet
    : isArray(pluginSet)
      ? [pluginSet, {}]
      : [[], pluginSet];

  const pluggables = defaultPlugins.length
    ? mergePluginPluggables(defaultPlugins, plugins)
    : plugins;

  return pluggables.map((pluggable): AnyPluggable => {
    const Plugin = isArray(pluggable) ? pluggable[0] : pluggable;

    const key = isOnceFunction(Plugin) ? Plugin.name.toLowerCase() : Plugin.key;

    if (!has(configs, [key])) {
      return pluggable;
    }

    const config: unknown = get(configs, [key]);

    if (!isObject(config)) {
      return pluggable;
    }

    return [Plugin, { ...(isArray(pluggable) ? pluggable[1] : {}), ...config }];
  });
}

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

      const instance = new clazz(config);

      if (config?.priority !== undefined) {
        Object.defineProperty(instance, 'config', {
          configurable: true,
          enumerable: true,
          value: { ...instance.config, priority: config.priority },
        });
      }

      return instance;
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
