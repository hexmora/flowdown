import type { IReactiveState } from '@flowdown/reactive';

import { BaseStateClosure } from '@flowdown/reactive';
import { cacheDiffMap } from '@flowdown/utils';
import { shallowEqualArrays } from 'shallow-equal';

import type { IBlockState } from '../../states/base/base-block';
import type { BaseRenderPlugin } from '../base-render-plugin';
import type { BaseRendererStateClosureParams, IRenderPatchItem } from './type';

export * from './type';

export abstract class BaseRendererStateClosure<T, E, P, R, C = {}> extends BaseStateClosure<R[]> {
  protected readonly source: IReactiveState<IBlockState<T>[]>;

  protected readonly patches: IReactiveState<IRenderPatchItem<R>[]>;

  protected readonly plugins: IReactiveState<BaseRenderPlugin<E, P, R, C>[]>;

  constructor({ source, patches, plugins }: BaseRendererStateClosureParams<T, E, P, R, C>) {
    super({
      source: () => this.getRenderedState(),
    });

    this.source = source;

    this.patches = patches;

    this.plugins = plugins;
  }

  protected abstract renderItem(item: IBlockState<T>): R;

  private renderItems(items: IBlockState<T>[]) {
    return items.map((item) => this.renderItem(item));
  }

  private getRenderedState() {
    return this.combineMap(
      [this.source, this.plugins],
      ([currentSource, currentPlugins], prev): R[] => {
        if (!prev) {
          return this.renderItems(currentSource);
        }

        const [[prevSource, prevPlugins], prevRendered] = prev;

        if (!shallowEqualArrays(prevPlugins, currentPlugins)) {
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
      (left, right) => shallowEqualArrays(left, right),
    );
  }
}
