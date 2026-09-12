import type { IRangeState } from '@fluxdown/types';

import { compute } from '@fluxdown/utils';
import { BaseStateClosure } from 'functive';
import { isUndefined } from 'lodash-es';

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
