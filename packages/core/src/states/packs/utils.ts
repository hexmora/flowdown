import type {
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
import { get, isArray, isEqual, isObjectLike } from 'lodash-es';

import type { IRenderPatchItem } from '../../externals/base-renderer';
import type { BlockCompilerConfig, BlockRemarksConfig } from '../hast/block-compiler';
import type { IPatchItem } from './type';

export interface Keyable {
  key: string;
}

export const isKeyablesEqual = <T extends Keyable>(left: T[], right: T[]): boolean => {
  return (
    left.length === right.length &&
    left.every((item, index) => item.key === right[index]?.key && isEqual(item, right[index]))
  );
};

export const splitPatches = <R>(patches: IPatchItem<R>[]) => {
  const usedKeys = new Set(patches.flatMap(({ key }) => (key === undefined ? [] : [key])));
  const rawPatches: IRawPatchItem[] = [];
  const renderPatches: IRenderPatchItem<R>[] = [];
  let fallbackIndex = 0;

  for (const { key: explicitKey, range, render } of patches) {
    let key = explicitKey;

    if (key === undefined) {
      key = String(fallbackIndex);
      fallbackIndex += 1;

      while (usedKeys.has(key)) {
        key = `_${key}`;
      }

      usedKeys.add(key);
    }

    rawPatches.push({ key, range });
    renderPatches.push({ key, render });
  }

  return { rawPatches, renderPatches };
};

export const toRawPatches = <R>(patches: IPatchItem<R>[]): IRawPatchItem[] => {
  const { rawPatches } = splitPatches(patches);

  return rawPatches;
};

export const toRenderPatches = <R>(patches: IPatchItem<R>[]): IRenderPatchItem<R>[] => {
  const { renderPatches } = splitPatches(patches);

  return renderPatches;
};

type RuntimePluginConfigs = Record<string, unknown>;

type PluginClassesParams<T extends IPluginWithConfig> = {
  config: BlockCompilerConfig;
  extras: readonly PluginClass<T>[];
};

const mergePluginClasses = <T>(presets: readonly T[], extras: readonly T[]): T[] => {
  const classes: T[] = [];

  for (const Plugin of [...presets, ...extras]) {
    if (!classes.includes(Plugin)) {
      classes.push(Plugin);
    }
  }

  return classes;
};

export const getRemarkClasses = ({
  config,
  extras,
}: PluginClassesParams<IRemarkPlugin>): PluginClass<IRemarkPlugin>[] => {
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

  return mergePluginClasses(presets, extras);
};

export const getRehypeClasses = ({
  config,
  extras,
}: PluginClassesParams<IRehypePlugin>): PluginClass<IRehypePlugin>[] => {
  const presets = PRESET_REHYPE_PLUGINS.filter(
    (Plugin) => Plugin !== HoistFootnoteRehypePlugin || config.footnote,
  );

  return mergePluginClasses(presets, extras);
};

export const getRepairClasses = ({
  config,
  extras,
}: PluginClassesParams<IRepairPlugin>): PluginClass<IRepairPlugin>[] => {
  if (!config.repair) {
    return [];
  }

  const presets = PRESET_REPAIR_PLUGINS.filter(
    (Plugin) => Plugin !== DanglingFootnoteRepairPlugin || config.footnote,
  );

  return mergePluginClasses(presets, extras);
};

const isPluginConfig = (value: unknown): value is RuntimePluginConfigs => {
  return isObjectLike(value) && !isArray(value);
};

const getPluginConfig = (configs: RuntimePluginConfigs, key: string): RuntimePluginConfigs => {
  const config = get(configs, [key]);

  return isPluginConfig(config) ? config : {};
};

type RemarkPluginConfigsParams = {
  configs: RuntimePluginConfigs;
  blockConfig: BlockRemarksConfig;
  repairs: IRepairPlugin[];
};

export const getRemarkPluginConfigs = ({
  configs,
  blockConfig: { patches, repair, repairEnding },
  repairs,
}: RemarkPluginConfigsParams): RuntimePluginConfigs => ({
  ...configs,
  [PatchesRemarkPlugin.key]: {
    ...getPluginConfig(configs, PatchesRemarkPlugin.key),
    patches,
  },
  [SyntaxMathRemarkPlugin.key]: {
    ...getPluginConfig(configs, SyntaxMathRemarkPlugin.key),
    repairEnding: repair && repairEnding,
  },
  [ApplyRepairsRemarkPlugin.key]: {
    ...getPluginConfig(configs, ApplyRepairsRemarkPlugin.key),
    plugins: repairs,
    ending: repairEnding,
  },
});
