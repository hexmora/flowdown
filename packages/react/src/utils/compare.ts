import type { SmoothConfig } from '@flowdown/core';
import type { IPluggable, IPluginWithConfig } from '@flowdown/types';

import { isPluggableEqual } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import { every, isEqual } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { FlowdownConfig, FlowdownProps, IPluginItem } from '../types';

import { DEFAULT_CONFIG, EL, EO } from '../consts';
import { isPatchesEqual } from './patches';

export const isPluggablesEqual = <T extends IPluginWithConfig>(
  left: readonly IPluggable<T, unknown>[],
  right: readonly IPluggable<T, unknown>[],
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
  left: readonly IPluginItem[] = EL,
  right: readonly IPluginItem[] = EL,
): boolean => {
  return (
    left === right ||
    (left.length === right.length &&
      every(left, (item, index) => {
        const other = right[index];

        return item !== undefined && other !== undefined && isPluginItemEqual(item, other);
      }))
  );
};

const isBuildEqual = (
  left: FlowdownConfig | undefined,
  right: FlowdownConfig | undefined,
): boolean => {
  return (
    left === right ||
    shallowEqual(defaultsBy(left ?? EO, DEFAULT_CONFIG), defaultsBy(right ?? EO, DEFAULT_CONFIG))
  );
};

export const isSmoothEqual = (
  left: boolean | SmoothConfig | undefined,
  right: boolean | SmoothConfig | undefined,
): boolean => {
  return left === right || isEqual(left ?? false, right ?? false);
};

export const isPropsEqual = (
  left: Readonly<FlowdownProps>,
  right: Readonly<FlowdownProps>,
): boolean => {
  return (
    left === right ||
    [
      left.text === right.text,
      left.className === right.className,
      shallowEqual(left.style ?? EO, right.style ?? EO),
      isBuildEqual(left.build, right.build),
      isSmoothEqual(left.smooth, right.smooth),
      isPatchesEqual(left.patches ?? EL, right.patches ?? EL),
      isPluginItemsEqual(left.plugins, right.plugins),
    ].every((item) => item)
  );
};
