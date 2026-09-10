import type {
  BaseSmoothConfig,
  SchedulerType,
  SmoothConfig,
  SmoothSchedulerClass,
  SmoothTickerClass,
  TickerType,
} from '@flowdown/core-presets/mapper';

import { assert } from '@flowdown/utils';
import { isBoolean, isFunction, isString } from 'lodash-es';

import { ALL_SCHEDULERS, ALL_TICKERS } from '../consts';

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

export const toSmoothConfig = (config: boolean | SmoothConfig): BaseSmoothConfig => {
  const options: SmoothConfig = isBoolean(config)
    ? {
        enabled: config,
        ticker: isEnableRAF() ? 'raf' : 'interval',
        scheduler: 'spring',
      }
    : config;

  const { enabled = false, ticker, scheduler } = options;

  return {
    enabled,
    ticker: getTickerByType(ticker),
    scheduler: getSchedulerByType(scheduler),
  };
};
