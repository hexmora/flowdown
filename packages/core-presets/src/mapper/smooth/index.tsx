/**
 * @jsxImportSource reactive
 */

import type { IBlockState, IPluggableConfig } from '@flowdown/types';

import { D, type JSXDescriptor, once, useDefaults } from 'reactive';

import type { SmoothBaseInputs, SmoothInputs } from './type';

import { IntervalSmoothTicker, RafSmoothTicker, SpringSmoothScheduler } from './modules';
import { CutoffBlocks, SmoothCursor } from './states';
import { isEnableRAF } from './utils';

export * from './modules';
export * from './type';

declare global {
  interface MapperConfigs {
    smooth?: IPluggableConfig<SmoothBaseInputs>;
  }
}

export const Smooth = /*#__PURE__*/ once(function Smooth<T>({
  source,
  enabled: _enabled,
  ticker: _ticker,
  scheduler: _scheduler,
}: SmoothInputs<T>): JSXDescriptor<IBlockState<T>[]> {
  const enabled = useDefaults(_enabled, false);

  const ticker = useDefaults(_ticker, D(isEnableRAF() ? RafSmoothTicker : IntervalSmoothTicker));

  const scheduler = useDefaults(_scheduler, D(SpringSmoothScheduler));

  return (
    <CutoffBlocks<T>
      items={source}
      end={
        <SmoothCursor<T> source={source} enabled={enabled} ticker={ticker} scheduler={scheduler} />
      }
    />
  );
});
