import { BaseStateClosure } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { IBlockState } from '../../states/base';
import type { BaseRendererStateClosureInputs } from './type';

import { mapRendererItems } from './utils';

export * from './type';
export * from './utils';

export abstract class BaseRendererStateClosure<T, E, P, R, C = {}> extends BaseStateClosure<
  R[],
  BaseRendererStateClosureInputs<T, E, P, R, C>
> {
  protected abstract renderItem(item: IBlockState<T>): R;

  protected render() {
    const { plugins, source } = this.inputs;

    return this.combineMap(
      [source, plugins],
      (current, prev): R[] => mapRendererItems(current, prev, (item) => this.renderItem(item)),
      (left, right) => shallowEqual(left, right),
    );
  }
}
