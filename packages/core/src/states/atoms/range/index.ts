import type { IRangeState } from '@flowdown/types';

import { compute } from '@flowdown/utils';
import { isUndefined } from 'lodash-es';
import { BaseStateClosure } from 'reactive';

export class Range extends BaseStateClosure<IRangeState | null> {
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
