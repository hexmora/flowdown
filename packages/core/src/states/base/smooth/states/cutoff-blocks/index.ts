import { once, useClearable, useCombineMap, useMap } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { IBlockState } from '../../../base-block';
import type { CutoffBlockEntry, CutoffBlocksInputs } from './type';

import { clearCutoffBlocks, setCutoffBlocksPriority, toCutoffBlocks } from './utils';

export * from './type';

export const CutoffBlocks = /*#__PURE__*/ once(function CutoffBlocks<T>({
  items,
  end,
}: CutoffBlocksInputs<T>) {
  const entries = new Map<IBlockState<T>, CutoffBlockEntry<T>>();

  useClearable(() => clearCutoffBlocks(entries));

  const visible = useCombineMap(
    [items, end],
    ([current, position]) => current.slice(0, Math.max(0, position.blockIndex + 1)),
    shallowEqual,
  );

  const count = useMap(visible, (current) => current.length);

  const blocks = useCombineMap(
    [visible, end, count],
    ([current, position]) => toCutoffBlocks(entries, current, position, count),
    shallowEqual,
  );

  setCutoffBlocksPriority(blocks.value, entries, [visible.value, end.value, count.value]);

  return blocks;
});
