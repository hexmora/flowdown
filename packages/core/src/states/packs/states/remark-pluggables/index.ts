import type { IPluggable, IRemarkPlugin } from '@flowdown/types';

import {
  ApplyRepairsRemarkPlugin,
  PatchesRemarkPlugin,
  PRESET_REMARK_PLUGINS,
  SyntaxFootnoteRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/core-presets/remark';
import { memoReturns } from 'reactive';

import type { RemarkPluggablesInputs } from './type';

import { isPluggablesEqual, toPluggable } from '../../../base';
import { getPluggableClass, getPluggableConfig } from '../utils';

export * from './type';

export const RemarkPluggables = /*#__PURE__*/ memoReturns(function RemarkPluggables({
  config,
  extras,
  repairs,
}: RemarkPluggablesInputs): IPluggable<IRemarkPlugin, unknown>[] {
  const pluggables = toPluggable(extras, PRESET_REMARK_PLUGINS).filter((pluggable) => {
    const Plugin = getPluggableClass(pluggable);

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
}, isPluggablesEqual);
