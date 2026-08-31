import type { IPluggable, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';

import {
  ApplyRepairsRemarkPlugin,
  PatchesRemarkPlugin,
  PRESET_REMARK_PLUGINS,
  SyntaxFootnoteRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import { memo } from '@flowdown/reactive';
import { isEqual } from 'lodash-es';

import type { BlockRemarksConfig } from '../../../hast/block-compiler';

import { getPluggableClass, getPluggableConfig, mergePluginPluggables } from '../utils';

type RemarkPluggablesMapperProps = {
  config: BlockRemarksConfig;

  extras: readonly IPluggable<IRemarkPlugin, unknown>[];

  repairs: IRepairPlugin[];
};

export const RemarkPluggablesMapper = /*#__PURE__*/ memo(function RemarkPluggablesMapper({
  config,
  extras,
  repairs,
}: RemarkPluggablesMapperProps): IPluggable<IRemarkPlugin, unknown>[] {
  const presets = PRESET_REMARK_PLUGINS.filter((Plugin) => {
    if (Plugin === SyntaxFootnoteRemarkPlugin) {
      return config.footnote;
    }

    if (Plugin === SyntaxMathRemarkPlugin) {
      return config.tex;
    }

    if (Plugin === ApplyRepairsRemarkPlugin) {
      return config.repair;
    }

    return true;
  });

  const pluggables = mergePluginPluggables(presets, extras);

  return pluggables.map((pluggable) => {
    const Plugin = getPluggableClass(pluggable);

    const pluginConfig = getPluggableConfig(pluggable);

    if (Plugin === PatchesRemarkPlugin) {
      return [
        Plugin,
        {
          ...pluginConfig,
          patches: config.patches,
        },
      ];
    }

    if (Plugin === SyntaxMathRemarkPlugin) {
      return [
        Plugin,
        {
          ...pluginConfig,
          repairEnding: config.repair && config.repairEnding,
        },
      ];
    }

    if (Plugin === ApplyRepairsRemarkPlugin) {
      return [
        Plugin,
        {
          ...pluginConfig,
          plugins: repairs,
          ending: config.repairEnding,
        },
      ];
    }

    return pluggable;
  });
}, isEqual);
