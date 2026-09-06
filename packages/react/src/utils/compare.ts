import type { SmoothConfig } from '@flowdown/core';

import { isPluggablesEqual, isPluginConfigEqual } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import { every, isEqual } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { FlowdownConfig, FlowdownProps, IPluginItem } from '../types';

import { DEFAULT_CONFIG, EL, EO } from '../consts';
import { isPatchesEqual } from './patches';

const isPluginItemEqual = (left: IPluginItem, right: IPluginItem): boolean => {
  return (
    left === right ||
    (isPluginConfigEqual(left.config ?? {}, right.config ?? {}) &&
      isPluggablesEqual(left.remarks, right.remarks) &&
      isPluggablesEqual(left.rehypes, right.rehypes) &&
      isPluggablesEqual(left.repairs, right.repairs) &&
      isPluggablesEqual(left.mappers, right.mappers) &&
      isPluggablesEqual(left.renders, right.renders) &&
      isPluggablesEqual(left.slots, right.slots))
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
      isEqual(left.theme ?? 'light', right.theme ?? 'light'),
      isBuildEqual(left.build, right.build),
      isSmoothEqual(left.smooth, right.smooth),
      isPatchesEqual(left.patches ?? EL, right.patches ?? EL),
      isPluginItemsEqual(left.plugins, right.plugins),
    ].every((item) => item)
  );
};
