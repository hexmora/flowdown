import type { IRawPatchItem } from '@flowdown/types';

import { memoReturns } from 'reactive';

import type { RawPatchesMapperInputs } from './type';

import { isKeyablesEqual, splitPatches } from '../../utils';

export * from './type';

export const RawPatchesMapper = /*#__PURE__*/ memoReturns(function RawPatchesMapper<R>({
  patches,
}: RawPatchesMapperInputs<R>): IRawPatchItem[] {
  return splitPatches(patches).rawPatches;
}, isKeyablesEqual);
