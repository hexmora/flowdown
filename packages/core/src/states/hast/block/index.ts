import { HastRoot } from '../../../typings';
import { BaseBlockStateClosure, BaseBlockStateClosureParams, IBlockState } from '../../base';
import { getLengthOfHast, sliceHast } from './utils';

export * from './utils';

export class BlockStateClosure extends BaseBlockStateClosure<HastRoot> {
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

  protected create(params: BaseBlockStateClosureParams<HastRoot>): IBlockState<HastRoot> {
    return new BlockStateClosure(params);
  }
}
