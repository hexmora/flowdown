import type { IPluggable, IRepairPlugin } from '@fluxdown/types';

import { DanglingFootnoteRepairPlugin, PRESET_REPAIR_PLUGINS } from '@fluxdown/core-presets/repair';
import { memoReturns } from 'functive';

import type { RepairPluggablesMapperInputs } from './type';

import { isPluggablesEqual } from '../../../base';
import { mergePluginPluggables } from '../utils';

export * from './type';

export const RepairPluggablesMapper = /*#__PURE__*/ memoReturns(function RepairPluggablesMapper({
  config,
  extras,
}: RepairPluggablesMapperInputs): IPluggable<IRepairPlugin, unknown>[] {
  if (!config.repair) {
    return [];
  }

  const presets = PRESET_REPAIR_PLUGINS.filter(
    (Plugin) => Plugin !== DanglingFootnoteRepairPlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
}, isPluggablesEqual);
