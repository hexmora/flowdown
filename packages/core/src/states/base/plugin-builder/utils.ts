import {
  type IPluggable,
  type IPluginWithConfig,
  type PluginClass,
  PluginPriority,
} from '@flowdown/types';
import { assert } from '@flowdown/utils';
import { first, get, isArray, isEmpty, isEqual, sortBy } from 'lodash-es';

export const pluginsToPluggables = <T extends IPluginWithConfig>(
  plugins: PluginClass<T>[],
  config: Record<string, unknown>,
): IPluggable<T, unknown>[] => {
  return plugins.map((item) => {
    const targetConfig = get(config, [item.key]);

    if (isEmpty(targetConfig)) {
      return item;
    }

    return [item, targetConfig];
  });
};

export const isPluggableEqual = <T extends IPluginWithConfig>(
  left: IPluggable<T, unknown>,
  right: IPluggable<T, unknown>,
): boolean => {
  const [leftClass, leftConfig] = isArray(left) ? left : [left, undefined];
  const [rightClass, rightConfig] = isArray(right) ? right : [right, undefined];

  return leftClass === rightClass && isEqual(leftConfig, rightConfig);
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
