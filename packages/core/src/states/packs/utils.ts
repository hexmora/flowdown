import type {
  BaseShadConfig,
  BaseSmoothConfig,
  SchedulerType,
  ShadConfig,
  SmoothConfig,
  SmoothSchedulerClass,
  SmoothTickerClass,
  TickerType,
} from '@fluxdown/core-presets/mapper';
import type { IRawPatchItem } from '@fluxdown/types';

import { assert } from '@fluxdown/utils';
import { isBoolean, isEqual, isFunction, isString } from 'lodash-es';

import type { IRenderPatchItem } from '../../externals';
import type { IPatchItem } from './type';

import { ALL_SCHEDULERS, ALL_TICKERS } from './consts';

export interface Keyable {
  key: string;
}

export const isKeyablesEqual = <T extends Keyable>(left: T[], right: T[]): boolean => {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((item, index) => item.key === right[index]?.key && isEqual(item, right[index])))
  );
};

export const isEnableRAF = () => {
  return (
    isFunction(globalThis.requestAnimationFrame) && isFunction(globalThis.cancelAnimationFrame)
  );
};

export const getTickerByType = (type: TickerType | SmoothTickerClass): SmoothTickerClass => {
  if (!isString(type)) {
    return type;
  }

  const ticker = ALL_TICKERS.find((item) => item.name === type);

  assert(ticker, `Unknown ticker type: ${type}`);

  return ticker;
};

export const getSchedulerByType = (
  type: SchedulerType | SmoothSchedulerClass,
): SmoothSchedulerClass => {
  if (!isString(type)) {
    return type;
  }

  const scheduler = ALL_SCHEDULERS.find((item) => item.name === type);

  assert(scheduler, `Unknown scheduler type: ${type}`);

  return scheduler;
};

export const toBaseSmoothConfig = (config: boolean | SmoothConfig): BaseSmoothConfig => {
  const {
    enabled = false,
    ticker,
    scheduler,
  } = isBoolean(config)
    ? ({
        enabled: config,
        ticker: isEnableRAF() ? 'raf' : 'interval',
        scheduler: 'spring',
      } as const)
    : config;

  return {
    enabled,
    ticker: getTickerByType(ticker),
    scheduler: getSchedulerByType(scheduler),
  };
};

export const toBaseShadConfig = (config: boolean | ShadConfig): BaseShadConfig => {
  const { enabled = true, length = 2 } = isBoolean(config) ? { enabled: config } : config;

  return {
    enabled,
    length: Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0,
  };
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
