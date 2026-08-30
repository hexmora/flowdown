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
import { isArray, isBoolean, isEqual, isFunction, isObjectLike, isString } from 'lodash-es';

import type { IRenderPatchItem } from '../../modules';
import type { BlockCompilerConfig, BlockRemarksConfig } from '../hast/block-compiler';
import type {
  BaseSmoothConfig,
  IPatchItem,
  SmoothConfig,
  SmoothSchedulerClass,
  SmoothTickerClass,
} from './type';

import { IntervalSmoothTicker, RafSmoothTicker, SpringSmoothScheduler } from '../../modules';
import { ALL_SCHEDULERS, ALL_TICKERS } from './consts';

const isEnableRAF = (): boolean => {
  return (
    isFunction(globalThis.requestAnimationFrame) && isFunction(globalThis.cancelAnimationFrame)
  );
};

export const getTickerByType = (ticker: SmoothConfig['ticker']): SmoothTickerClass => {
  if (!isString(ticker)) {
    return ticker;
  }

  const Ticker = ALL_TICKERS.find((item) => item.name === ticker);

  if (!Ticker) {
    throw new Error(`Unknown ticker type: ${ticker}`);
  }

  return Ticker;
};

export const getSchedulerByType = (scheduler: SmoothConfig['scheduler']): SmoothSchedulerClass => {
  if (!isString(scheduler)) {
    return scheduler;
  }

  const Scheduler = ALL_SCHEDULERS.find((item) => item.name === scheduler);

  if (!Scheduler) {
    throw new Error(`Unknown scheduler type: ${scheduler}`);
  }

  return Scheduler;
};

export const toBaseSmoothConfig = (config: boolean | SmoothConfig): BaseSmoothConfig => {
  if (isBoolean(config)) {
    return {
      enabled: config,
      ticker: isEnableRAF() ? RafSmoothTicker : IntervalSmoothTicker,
      scheduler: SpringSmoothScheduler,
    };
  }

  return {
    enabled: config.enabled ?? false,
    ticker: getTickerByType(config.ticker),
    scheduler: getSchedulerByType(config.scheduler),
  };
};

export interface Keyable {
  key: string;
}

export const isKeyablesEqual = <T extends Keyable>(left: T[], right: T[]): boolean => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((current, index) => {
    const other = right[index];

    if (other === undefined) {
      return false;
    }

    const equalities = [
      current.key === other.key,

      isEqual(current, other),
    ];

    return equalities.every((item) => item);
  });
};

export const splitPatches = <R>(patches: IPatchItem<R>[]) => {
  const usedKeys = patches.flatMap(({ key }) => (key === undefined ? [] : [key]));

  const rawPatches: IRawPatchItem[] = [];

  const renderPatches: IRenderPatchItem<R>[] = [];

  let fallbackIndex = 0;

  for (const { key: explicitKey, range, render } of patches) {
    let key = explicitKey;

    if (key === undefined) {
      key = String(fallbackIndex);

      fallbackIndex += 1;

      while (usedKeys.includes(key)) {
        key = `_${key}`;
      }

      usedKeys.push(key);
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

type PluginPluggablesParams<T extends IPluginWithConfig> = {
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

type RemarkPluggablesParams = {
  config: BlockRemarksConfig;

  extras: readonly IPluggable<IRemarkPlugin, unknown>[];

  repairs: IRepairPlugin[];
};

export const getRemarkPluggables = ({
  config,
  extras,
  repairs,
}: RemarkPluggablesParams): IPluggable<IRemarkPlugin, unknown>[] => {
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
};

export const getRehypePluggables = ({
  config,
  extras,
}: PluginPluggablesParams<IRehypePlugin>): IPluggable<IRehypePlugin, unknown>[] => {
  const presets = PRESET_REHYPE_PLUGINS.filter(
    (Plugin) => Plugin !== HoistFootnoteRehypePlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
};

export const getRepairPluggables = ({
  config,
  extras,
}: PluginPluggablesParams<IRepairPlugin>): IPluggable<IRepairPlugin, unknown>[] => {
  if (!config.repair) {
    return [];
  }

  const presets = PRESET_REPAIR_PLUGINS.filter(
    (Plugin) => Plugin !== DanglingFootnoteRepairPlugin || config.footnote,
  );

  return mergePluginPluggables(presets, extras);
};
