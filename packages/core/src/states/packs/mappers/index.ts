import type {
  IPluggable,
  IPluginWithConfig,
  IRawPatchItem,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
  PluginClass,
} from '@flowdown/types';

import {
  ApplyRepairsRemarkPlugin,
  DanglingFootnoteRepairPlugin,
  HoistFootnoteRehypePlugin,
  PatchesRemarkPlugin,
  PRESET_REHYPE_PLUGINS,
  PRESET_REMARK_PLUGINS,
  PRESET_REPAIR_PLUGINS,
  SyntaxFootnoteRemarkPlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import { memo, type MemoizedStateMapper } from '@flowdown/reactive';
import { isArray, isEqual, isObjectLike } from 'lodash-es';

import type { IRenderPatchItem } from '../../../externals/base-renderer';
import type { BlockCompilerConfig, BlockRemarksConfig } from '../../hast/block-compiler';
import type { IPatchItem } from '../type';

import { isKeyablesEqual, splitPatches } from '../utils';

type PatchesMapperProps<R> = {
  patches: IPatchItem<R>[];
};

type RawPatchesMapperComponent = MemoizedStateMapper<
  <R>(props: PatchesMapperProps<R>) => IRawPatchItem[]
>;

export const RawPatchesMapper: RawPatchesMapperComponent = /*#__PURE__*/ memo(
  function RawPatchesMapper<R>({ patches }: PatchesMapperProps<R>): IRawPatchItem[] {
    return splitPatches(patches).rawPatches;
  },
  isKeyablesEqual,
);

type RenderPatchesMapperComponent = MemoizedStateMapper<
  <R>(props: PatchesMapperProps<R>) => IRenderPatchItem<R>[]
>;

export const RenderPatchesMapper: RenderPatchesMapperComponent = /*#__PURE__*/ memo(
  function RenderPatchesMapper<R>({ patches }: PatchesMapperProps<R>): IRenderPatchItem<R>[] {
    return splitPatches(patches).renderPatches;
  },
  isKeyablesEqual,
);

type PluginPluggablesMapperProps<T extends IPluginWithConfig> = {
  config: BlockCompilerConfig;

  extras: readonly IPluggable<T, unknown>[];
};

const getPluggableClass = <T extends IPluginWithConfig>(
  pluggable: IPluggable<T, unknown>,
): PluginClass<T> => (isArray(pluggable) ? pluggable[0] : pluggable);

const mergePluginPluggables = <T extends IPluginWithConfig>(
  presets: readonly IPluggable<T, unknown>[],
  extras: readonly IPluggable<T, unknown>[],
): IPluggable<T, unknown>[] => {
  const pluggables = [...presets];

  for (const extra of extras) {
    const Plugin = getPluggableClass(extra);

    const index = pluggables.findIndex((item) => getPluggableClass(item) === Plugin);

    if (index === -1) {
      pluggables.push(extra);

      continue;
    }

    pluggables[index] = extra;
  }

  return pluggables;
};

const isPluginConfig = (value: unknown): value is Record<string, unknown> => {
  return isObjectLike(value) && !isArray(value);
};

const getPluggableConfig = <T extends IPluginWithConfig>(
  pluggable: IPluggable<T, unknown>,
): Record<string, unknown> => {
  if (!isArray(pluggable)) {
    return {};
  }

  const config = pluggable[1];

  return isPluginConfig(config) ? config : {};
};

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

export const RehypePluggablesMapper = /*#__PURE__*/ memo(function RehypePluggablesMapper({
  config,
  extras,
}: PluginPluggablesMapperProps<IRehypePlugin>): IPluggable<IRehypePlugin, unknown>[] {
  const presets = PRESET_REHYPE_PLUGINS.filter(
    (Plugin) => Plugin !== HoistFootnoteRehypePlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
}, isEqual);

export const RepairPluggablesMapper = /*#__PURE__*/ memo(function RepairPluggablesMapper({
  config,
  extras,
}: PluginPluggablesMapperProps<IRepairPlugin>): IPluggable<IRepairPlugin, unknown>[] {
  if (!config.repair) {
    return [];
  }

  const presets = PRESET_REPAIR_PLUGINS.filter(
    (Plugin) => Plugin !== DanglingFootnoteRepairPlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
}, isEqual);
