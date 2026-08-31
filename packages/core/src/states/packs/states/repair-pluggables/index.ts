import type { IPluggable, IRepairPlugin } from '@flowdown/types';

import { DanglingFootnoteRepairPlugin, PRESET_REPAIR_PLUGINS } from '@flowdown/preset-plugins';
import { memo } from '@flowdown/reactive';
import { isEqual } from 'lodash-es';

import type { BlockCompilerConfig } from '../../../hast/block-compiler';

import { mergePluginPluggables } from '../utils';

type RepairPluggablesMapperProps = {
  config: BlockCompilerConfig;

  extras: readonly IPluggable<IRepairPlugin, unknown>[];
};

export const RepairPluggablesMapper = /*#__PURE__*/ memo(function RepairPluggablesMapper({
  config,
  extras,
}: RepairPluggablesMapperProps): IPluggable<IRepairPlugin, unknown>[] {
  if (!config.repair) {
    return [];
  }

  const presets = PRESET_REPAIR_PLUGINS.filter(
    (Plugin) => Plugin !== DanglingFootnoteRepairPlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
}, isEqual);
