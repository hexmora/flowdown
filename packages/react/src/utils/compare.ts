import type { SmoothConfig } from '@fluxdown/core-presets/mapper';

import { isPluggablesEqual, isPluginConfigEqual } from '@fluxdown/core';
import { defaultsBy } from '@fluxdown/utils';
import { every, isEqual } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { FluxdownConfig, FluxdownProps, IPluginItem, ShadConfig } from '../types';

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
  left: FluxdownConfig | undefined,
  right: FluxdownConfig | undefined,
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

export const isShadEqual = (
  left: boolean | ShadConfig | undefined,
  right: boolean | ShadConfig | undefined,
): boolean => {
  return left === right || isEqual(left ?? false, right ?? false);
};

export const isPropsEqual = (
  left: Readonly<FluxdownProps>,
  right: Readonly<FluxdownProps>,
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
      isShadEqual(left.shad, right.shad),
      isPatchesEqual(left.patches ?? EL, right.patches ?? EL),
      isPluginItemsEqual(left.plugins, right.plugins),
    ].every((item) => item)
  );
};
