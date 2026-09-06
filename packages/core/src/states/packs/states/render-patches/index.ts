import { memoReturns } from 'reactive';

import type { IRenderPatchItem } from '../../../../externals';
import type { RenderPatchesMapperInputs } from './type';

import { isKeyablesEqual, splitPatches } from '../../utils';

export * from './type';

export const RenderPatchesMapper = /*#__PURE__*/ memoReturns(function RenderPatchesMapper<R>({
  patches,
}: RenderPatchesMapperInputs<R>): IRenderPatchItem<R>[] {
  return splitPatches(patches).renderPatches;
}, isKeyablesEqual);
