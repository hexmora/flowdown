import { BaseStateClosure } from '@flowdown/reactive';
import { compute } from '@flowdown/utils';

import type { IRangeState } from './type';

export * from './type';

export class RangeStateClosure extends BaseStateClosure<IRangeState | null> {
  setRange(range?: IRangeState) {
    if (this.destroyed) {
      return;
    }

    const newRange = compute<IRangeState | null>(() => {
      const { start, end } = range ?? {};

      if (start === undefined && end === undefined) {
        return null;
      }

      return { start, end };
    });

    this.next(newRange);
  }
}
