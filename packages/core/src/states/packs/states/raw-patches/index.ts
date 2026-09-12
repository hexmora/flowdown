import type { IRawPatchItem } from '@fluxdown/types';

import { memoReturns } from 'functive';

import type { RawPatchesMapperInputs } from './type';

import { isKeyablesEqual, splitPatches } from '../../utils';

export * from './type';

export const RawPatchesMapper = /*#__PURE__*/ memoReturns(function RawPatchesMapper<R>({
  patches,
}: RawPatchesMapperInputs<R>): IRawPatchItem[] {
  return splitPatches(patches).rawPatches;
}, isKeyablesEqual);
