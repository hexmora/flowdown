import type { IBlockState } from '@fluxdown/types';
import type { Root as HastRoot } from 'hast';

import { once, useClearable, useMap } from 'functive';
import { last } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { ShadBlockEntry, ShadBlocksInputs } from './type';

import { clearShadBlocks, setShadBlocksPriority, toShadBlocks } from './utils';

export const ShadBlocks = /*#__PURE__*/ once(function ShadBlocks({
  source,
  progress,
}: ShadBlocksInputs) {
  const entries = new Map<IBlockState<HastRoot>, ShadBlockEntry>();

  useClearable(() => clearShadBlocks(entries));

  const tail = useMap(source, (blocks) => last(blocks));

  const blocks = useMap(
    source,
    (items) => toShadBlocks(entries, items, tail, progress),
    shallowEqual,
  );

  setShadBlocksPriority(blocks.value, entries, [source.value, tail.value, progress.value]);

  return blocks;
});
