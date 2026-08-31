import type { IRawPatchItem } from '@flowdown/types';

import { memo, type MemoizedStateMapper } from '@flowdown/reactive';

import type { IPatchItem } from '../../type';

import { isKeyablesEqual, splitPatches } from '../../utils';

type RawPatchesMapperProps<R> = {
  patches: IPatchItem<R>[];
};

type RawPatchesMapperComponent = MemoizedStateMapper<
  <R>(props: RawPatchesMapperProps<R>) => IRawPatchItem[]
>;

export const RawPatchesMapper: RawPatchesMapperComponent = /*#__PURE__*/ memo(
  function RawPatchesMapper<R>({ patches }: RawPatchesMapperProps<R>): IRawPatchItem[] {
    return splitPatches(patches).rawPatches;
  },
  isKeyablesEqual,
);
