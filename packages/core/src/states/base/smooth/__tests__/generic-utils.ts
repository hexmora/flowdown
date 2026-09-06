import { MutableState, render, S } from 'reactive';

import type { IBlockMeta } from '../../base-block';

import { BaseBlockItem } from '../../base-block';

export class ArrayBlock<T> extends BaseBlockItem<T[]> {
  protected slice(value: T[], start: number, end: number) {
    return value.slice(start, end);
  }

  protected lengthOf(value: T[]) {
    return value.length;
  }
}

export const createArrayBlock = <T>(value: T[], key = 'block') => {
  const source = MutableState.of(value);

  const meta = MutableState.of<IBlockMeta>({
    key,
    sourceText: '',
    charStart: 0,
    charEnd: value.length,
    currentIndex: 0,
    blockCount: 1,
  });

  const block = render(S([ArrayBlock<T>, { source, meta }]));

  return { block, source, meta };
};
