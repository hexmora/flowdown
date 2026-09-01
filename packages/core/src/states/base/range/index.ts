import { compute } from '@flowdown/utils';
import { isUndefined } from 'lodash-es';
import { BaseStateClosure } from 'reactive';

import type { IRangeState } from './type';

export * from './type';

export class RangeStateClosure extends BaseStateClosure<IRangeState | null> {
  protected render() {
    return null;
  }

  setRange(range?: IRangeState) {
    if (this.destroyed) {
      return;
    }

    const newRange = compute<IRangeState | null>(() => {
      const { start, end } = range ?? {};

      if (isUndefined(start) && isUndefined(end)) {
        return null;
      }

      return { start, end };
    });

    this.next(newRange);
  }
}
