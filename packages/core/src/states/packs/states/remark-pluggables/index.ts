import type { IPluggable, IRemarkPlugin } from '@flowdown/types';

import {
  ApplyRepairsRemarkPlugin,
  PatchesRemarkPlugin,
  PRESET_REMARK_PLUGINS,
  SyntaxFootnoteRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import { isEqual } from 'lodash-es';
import { memo } from 'reactive';

import type { RemarkPluggablesMapperInputs } from './type';

import { getPluggableClass, getPluggableConfig, mergePluginPluggables } from '../utils';

export * from './type';

export const RemarkPluggablesMapper = /*#__PURE__*/ memo(function RemarkPluggablesMapper({
  config,
  extras,
  repairs,
}: RemarkPluggablesMapperInputs): IPluggable<IRemarkPlugin, unknown>[] {
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
