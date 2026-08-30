import type { ReactiveState } from '@flowdown/reactive';

import { BaseStateClosure, combineMapState, MutableState } from '@flowdown/reactive';
import { assert } from '@flowdown/utils';
import { findLastIndex, isEqual } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { HastRoot } from '../../../../../typings';
import type { IBlockMeta, IBlockState, IRangeState } from '../../../../base';
import type { SmoothCursorFrame } from '../cursor';
import type { SmoothBlocksStateClosureParams } from './type';

export * from './type';

type VisibleBlockEntry = {
  count: MutableState<number>;

  fork: IBlockState<HastRoot>;

  meta: ReactiveState<IBlockMeta>;

  range: MutableState<IRangeState | null>;

  source: IBlockState<HastRoot>;
};

const destroyEntry = ({ count, fork, meta, range }: VisibleBlockEntry) => {
  fork.destroy();

  meta.destroy();

  count.destroy();

  range.destroy();
};

const createEntry = (
  source: IBlockState<HastRoot>,
  blockCount: number,
  initialRange: IRangeState | null,
): VisibleBlockEntry => {
  const count = MutableState.of(blockCount);

  const range = MutableState.of<IRangeState | null>(initialRange);

  const meta = combineMapState(
    [source.meta, count],
    ([currentMeta, currentBlockCount]): IBlockMeta => ({
      ...currentMeta,
      blockCount: currentBlockCount,
    }),
    isEqual,
  );

  try {
    const fork = source.fork({ meta, range });

    return { count, fork, meta, range, source };
  } catch (error) {
    meta.destroy();

    count.destroy();

    range.destroy();

    throw error;
  }
};

const getTailIndex = ({ cursor, fullIndex, lengths }: SmoothCursorFrame) => {
  if (fullIndex <= 0) {
    return -1;
  }

  if (cursor <= 0) {
    return 0;
  }

  let end = 0;

  const index = lengths.findIndex((length) => {
    end += length;

    return length > 0 && end >= cursor;
  });

  return index >= 0 ? index : findLastIndex(lengths, (length) => length > 0);
};

export class SmoothBlocksStateClosure extends BaseStateClosure<
  IBlockState<HastRoot>[],
  SmoothBlocksStateClosureParams
> {
  protected render() {
    const { frame } = this.inputs;

    let entries: VisibleBlockEntry[] = [];

    const destroyEntries = () => {
      for (const entry of entries) {
        destroyEntry(entry);
      }

      entries = [];
    };

    try {
      const blocks = this.map(
        frame,
        (currentFrame) => {
          const { blocks: sourceBlocks, cursor, lengths } = currentFrame;

          assert(
            sourceBlocks.length === lengths.length,
            'Smooth source blocks and lengths must have the same length.',
          );

          const tailIndex = getTailIndex(currentFrame);

          const visibleCount = tailIndex + 1;

          const used = new Set<VisibleBlockEntry>();

          const nextEntries: VisibleBlockEntry[] = [];

          let start = 0;

          for (let index = 0; index < visibleCount; index += 1) {
            const source = sourceBlocks[index];

            const length = lengths[index];

            assert(source, 'A visible smooth block must have a source block.');

            assert(length !== undefined, 'A visible smooth block must have a source length.');

            const nextRange: IRangeState | null =
              index === tailIndex
                ? {
                    start: 0,
                    end: Math.min(length, Math.max(0, cursor - start)),
                  }
                : null;

            let entry = entries.find((item) => item.source === source && !used.has(item));

            entry ??= createEntry(source, visibleCount, nextRange);

            used.add(entry);

            if (entry.count.value !== visibleCount) {
              entry.count.next(visibleCount);
            }

            if (!isEqual(entry.range.value, nextRange)) {
              entry.range.next(nextRange);
            }

            nextEntries.push(entry);

            start += length;
          }

          for (const entry of entries) {
            if (!used.has(entry)) {
              destroyEntry(entry);
            }
          }

          entries = nextEntries;

          return nextEntries.map(({ fork }) => fork);
        },
        shallowEqual,
      );

      this.clearable(destroyEntries);

      return blocks;
    } catch (error) {
      destroyEntries();

      throw error;
    }
  }
}
