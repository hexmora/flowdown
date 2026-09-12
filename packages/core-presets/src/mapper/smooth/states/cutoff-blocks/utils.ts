import type { IBlockState } from '@fluxdown/types';

import {
  BatchScheduler,
  D,
  type IReactiveState,
  type IReadableClosure,
  MutableState,
  render,
  S,
} from 'functive';
import { max } from 'lodash-es';
import { Subscription } from 'rxjs';

import type { SmoothPosition } from '../smooth-cursor/states';
import type { CutoffBlockEntry } from './type';

import { CutoffBlock } from './states';

const releaseCutoffBlock = <T>({ end, closure }: CutoffBlockEntry<T>) => {
  try {
    closure.destroy();
  } finally {
    end.destroy();
  }
};

export const clearCutoffBlocks = <T>(entries: Map<IBlockState<T>, CutoffBlockEntry<T>>) => {
  const cleanup = new Subscription();

  entries.forEach((entry) => cleanup.add(() => releaseCutoffBlock(entry)));

  entries.clear();

  cleanup.unsubscribe();
};

export const setCutoffBlocksPriority = <T>(
  state: IReactiveState<IBlockState<T>[]>,
  entries: Map<IBlockState<T>, CutoffBlockEntry<T>>,
  inputs: IReactiveState<unknown>[],
) => {
  BatchScheduler.setPriority(state, () => {
    const children = [...entries.values()].flatMap((entry) => entry.dependencies);

    return (
      (max([...inputs, ...children].map((input) => BatchScheduler.getPriority(input))) ?? 0) + 1
    );
  });
};

export const toCutoffBlocks = <T>(
  entries: Map<IBlockState<T>, CutoffBlockEntry<T>>,
  items: IBlockState<T>[],
  end: SmoothPosition,
  count: IReadableClosure<number>,
): IBlockState<T>[] => {
  const retained = new Set(items);

  for (const [source, entry] of entries) {
    if (!retained.has(source)) {
      entries.delete(source);

      releaseCutoffBlock(entry);
    }
  }

  return items.map((source, blockIndex) => {
    const boundary = blockIndex === end.blockIndex ? end.charIndex : null;

    let entry = entries.get(source);

    if (!entry) {
      const range = MutableState.of(boundary);

      const closure = render(S([CutoffBlock<T>, { source: D(source), end: range, count }]));

      entry = { end: range, closure, dependencies: [] };

      entries.set(source, entry);
    } else {
      entry.end.next(boundary);
    }

    try {
      const block = entry.closure.value.value;

      if (entry.dependencies.length === 0) {
        entry.dependencies.push(block, block.meta, block.range);
      }

      return block;
    } catch (error) {
      entries.delete(source);

      releaseCutoffBlock(entry);

      throw error;
    }
  });
};
