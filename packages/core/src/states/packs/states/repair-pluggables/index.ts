import type { IPluggable, IRepairPlugin } from '@fluxdown/types';

import { DanglingFootnoteRepairPlugin, PRESET_REPAIR_PLUGINS } from '@fluxdown/core-presets/repair';
import { memoReturns } from 'functive';

import type { RepairPluggablesInputs } from './type';

import { isPluggablesEqual, toPluggable } from '../../../base';
import { getPluggableClass } from '../utils';

export * from './type';

export const RepairPluggables = /*#__PURE__*/ memoReturns(function RepairPluggables({
  config,
  extras,
}: RepairPluggablesInputs): IPluggable<IRepairPlugin, unknown>[] {
  if (!config.repair) {
    return [];
  }

  return toPluggable(extras, PRESET_REPAIR_PLUGINS).filter(
    (pluggable) => getPluggableClass(pluggable) !== DanglingFootnoteRepairPlugin || config.footnote,
  );
}, isPluggablesEqual);
