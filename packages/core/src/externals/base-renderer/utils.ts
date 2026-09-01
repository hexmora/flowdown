import { cacheDiffMap } from '@flowdown/utils';
import { shallowEqual } from 'shallow-equal';

import type { IBlockState } from '../../states/base';

export const mapRendererItems = <T, P, R>(
  [currentSource, currentPlugins]: [IBlockState<T>[], P[]],
  prev: [[IBlockState<T>[], P[]], R[]] | null,
  renderItem: (item: IBlockState<T>) => R,
): R[] => {
  if (!prev) {
    return currentSource.map(renderItem);
  }

  const [[prevSource, prevPlugins], prevRendered] = prev;

  if (!shallowEqual(prevPlugins, currentPlugins)) {
    return currentSource.map(renderItem);
  }

  const prevEntries = prevSource.map((item, index): [IBlockState<T>, R] => [
    item,
    prevRendered[index],
  ]);

  return cacheDiffMap({
    prev: prevEntries,
    current: currentSource,
    mapper: renderItem,
    comparer: (left, right) => left.meta.value.key === right.meta.value.key,
  });
};
