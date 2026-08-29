import type { IPluggable, IPluginWithConfig } from '@flowdown/types';

import { isPluggableEqual } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import { isEqual } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { FlowdownConfig, FlowdownProps, IPluginItem } from '../types';

import { DEFAULT_CONFIG, EO } from '../consts';
import { isPatchesEqual } from './patches';

export const isPluggablesEqual = <T extends IPluginWithConfig>(
  left: readonly IPluggable<T, unknown>[],
  right: readonly IPluggable<T, unknown>[],
): boolean => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const pluggable = left[index];
    const other = right[index];

    if (pluggable === undefined || other === undefined || !isPluggableEqual(pluggable, other)) {
      return false;
    }
  }

  return true;
};

const isOptionalPluggablesEqual = <T extends IPluginWithConfig>(
  left: readonly IPluggable<T, unknown>[] | undefined,
  right: readonly IPluggable<T, unknown>[] | undefined,
): boolean => {
  return left === right || isPluggablesEqual(left ?? [], right ?? []);
};

const isPluginItemEqual = (left: IPluginItem, right: IPluginItem): boolean => {
  return (
    left === right ||
    (isEqual(left.config ?? {}, right.config ?? {}) &&
      isOptionalPluggablesEqual(left.remarks, right.remarks) &&
      isOptionalPluggablesEqual(left.rehypes, right.rehypes) &&
      isOptionalPluggablesEqual(left.repairs, right.repairs) &&
      isOptionalPluggablesEqual(left.renders, right.renders) &&
      isOptionalPluggablesEqual(left.slots, right.slots))
  );
};

const isPluginItemsEqual = (
  left: readonly IPluginItem[] | undefined,
  right: readonly IPluginItem[] | undefined,
): boolean => {
  if (left === right) {
    return true;
  }

  const leftItems = left ?? [];
  const rightItems = right ?? [];

  if (leftItems.length !== rightItems.length) {
    return false;
  }

  for (let index = 0; index < leftItems.length; index += 1) {
    const item = leftItems[index];
    const other = rightItems[index];

    if (item === undefined || other === undefined || !isPluginItemEqual(item, other)) {
      return false;
    }
  }

  return true;
};

const isConfigEqual = (
  left: FlowdownConfig | undefined,
  right: FlowdownConfig | undefined,
): boolean => {
  return (
    left === right ||
    shallowEqual(defaultsBy(left ?? EO, DEFAULT_CONFIG), defaultsBy(right ?? EO, DEFAULT_CONFIG))
  );
};

export const isPropsEqual = (
  left: Readonly<FlowdownProps>,
  right: Readonly<FlowdownProps>,
): boolean => {
  return (
    left === right ||
    (left.text === right.text &&
      left.className === right.className &&
      shallowEqual(left.style ?? EO, right.style ?? EO) &&
      isConfigEqual(left.config, right.config) &&
      (left.patches === right.patches || isPatchesEqual(left.patches ?? [], right.patches ?? [])) &&
      isPluginItemsEqual(left.plugins, right.plugins))
  );
};
