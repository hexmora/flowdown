import { BaseStateClosure, S } from '@flowdown/reactive';

import type { HastRoot } from '../../../typings';
import type { IBlockState } from '../../base';
import type { SmoothStateClosureParams } from './type';

import {
  SmoothBlocksStateClosure,
  SmoothCursorStateClosure,
  SmoothSourceStateClosure,
} from './states';

export * from './type';

export class SmoothStateClosure extends BaseStateClosure<
  IBlockState<HastRoot>[],
  SmoothStateClosureParams
> {
  protected render() {
    const { source, enabled, ticker, scheduler } = this.inputs;

    const lifecycle = this.combine(source, enabled, ticker, scheduler);

    const lifecycleBlocks = this.map(lifecycle, ([currentBlocks]) => currentBlocks);

    const lifecycleEnabled = this.map(lifecycle, ([, currentEnabled]) => currentEnabled);

    const lifecycleTicker = this.map(lifecycle, ([, , currentTicker]) => currentTicker);

    const lifecycleScheduler = this.map(lifecycle, ([, , , currentScheduler]) => currentScheduler);

    return S([
      SmoothBlocksStateClosure,
      {
        frame: S([
          SmoothCursorStateClosure,
          {
            source: S([SmoothSourceStateClosure, { source: lifecycleBlocks }]),
            enabled: lifecycleEnabled,
            ticker: lifecycleTicker,
            scheduler: lifecycleScheduler,
          },
        ]),
      },
    ]);
  }
}
