import { memo, type MemoizedStateMapper } from '@flowdown/reactive';

import type { IRenderPatchItem } from '../../../../externals/base-renderer';
import type { IPatchItem } from '../../type';

import { isKeyablesEqual, splitPatches } from '../../utils';

type RenderPatchesMapperProps<R> = {
  patches: IPatchItem<R>[];
};

type RenderPatchesMapperComponent = MemoizedStateMapper<
  <R>(props: RenderPatchesMapperProps<R>) => IRenderPatchItem<R>[]
>;

export const RenderPatchesMapper: RenderPatchesMapperComponent = /*#__PURE__*/ memo(
  function RenderPatchesMapper<R>({ patches }: RenderPatchesMapperProps<R>): IRenderPatchItem<R>[] {
    return splitPatches(patches).renderPatches;
  },
  isKeyablesEqual,
);
