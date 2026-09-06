import { isEqual } from 'lodash-es';

import type { RawPatchesMapperInputs } from './type';

export const isInputsEqual = <R>(
  left: RawPatchesMapperInputs<R>,
  right: RawPatchesMapperInputs<R>,
): boolean => {
  return (
    left.patches.length === right.patches.length &&
    left.patches.every((patch, index) => {
      const other = right.patches[index];

      return patch.key === other?.key && isEqual(patch.range, other?.range);
    })
  );
};
