import type { IPluggable, IRepairPlugin } from '@flowdown/types';

import { DanglingFootnoteRepairPlugin, PRESET_REPAIR_PLUGINS } from '@flowdown/preset-plugins';
import { isEqual } from 'lodash-es';
import { memo } from 'reactive';

import type { RepairPluggablesMapperInputs } from './type';

import { mergePluginPluggables } from '../utils';

export * from './type';

export const RepairPluggablesMapper = /*#__PURE__*/ memo(function RepairPluggablesMapper({
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
}, isEqual);
