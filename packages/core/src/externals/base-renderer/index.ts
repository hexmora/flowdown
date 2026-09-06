import { BaseStateClosure } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { IBlockState } from '../../states/base';
import type { BaseRendererInputs } from './type';

import { mapRendererItems } from './utils';

export * from './type';
export * from './utils';

export abstract class BaseRenderer<T, E, P, R, C = {}> extends BaseStateClosure<
  R[],
  BaseRendererInputs<T, E, P, R, C>
> {
  protected abstract renderItem(item: IBlockState<T>): R;

  protected render() {
    const { plugins, source } = this.inputs;

    return this.combineMap(
      [source, plugins],
      (current, prev): R[] => mapRendererItems(current, prev, (item) => this.renderItem(item)),
      shallowEqual,
    );
  }
}
