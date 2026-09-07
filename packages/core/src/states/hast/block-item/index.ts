import { getLengthOfHast, sliceHast } from '@flowdown/utils';

import type { HastRoot } from '../../../typings';

import { BaseBlockItem } from '../../base';

export class BlockItem extends BaseBlockItem<HastRoot> {
  protected slice(value: HastRoot, start: number, end: number): HastRoot {
    const sliced = sliceHast(value, start, end);

    if (sliced) {
      return sliced;
    }

    return {
      ...value,
      children: [],
    };
  }

  protected lengthOf(value: HastRoot) {
    return getLengthOfHast(value);
  }
}
