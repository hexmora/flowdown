import { BaseStateClosure } from '@flowdown/reactive';
import { cacheDiffMap } from '@flowdown/utils';
import { shallowEqual } from 'shallow-equal';

import type { IBlockState } from '../../states/base/base-block';
import type { BaseRendererStateClosureParams } from './type';

export * from './type';

export abstract class BaseRendererStateClosure<T, E, P, R, C = {}> extends BaseStateClosure<
  R[],
  BaseRendererStateClosureParams<T, E, P, R, C>
> {
  protected abstract renderItem(item: IBlockState<T>): R;

  private renderItems(items: IBlockState<T>[]) {
    return items.map((item) => this.renderItem(item));
  }

  protected render() {
    const { plugins, source } = this.inputs;

    return this.combineMap(
      [source, plugins],
      ([currentSource, currentPlugins], prev): R[] => {
        if (!prev) {
          return this.renderItems(currentSource);
        }

        const [[prevSource, prevPlugins], prevRendered] = prev;

        if (!shallowEqual(prevPlugins, currentPlugins)) {
          return this.renderItems(currentSource);
        }

        const prevEntries = prevSource.map((item, index): [IBlockState<T>, R] => [
          item,
          prevRendered[index],
        ]);

        return cacheDiffMap({
          prev: prevEntries,
          current: currentSource,
          mapper: (item) => this.renderItem(item),
          comparer: (left, right) => left.meta.value.key === right.meta.value.key,
        });
      },
      (left, right) => shallowEqual(left, right),
    );
  }
}
