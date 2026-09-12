import type { IPatchItem } from '@fluxdown/core';
import type { IRawPatchRange } from '@fluxdown/types';

import { isNumber } from 'lodash-es';

const isPatchRangeEqual = (left: IRawPatchRange, right: IRawPatchRange): boolean => {
  return (
    left === right ||
    ((isNumber(left) ? left : left[0]) === (isNumber(right) ? right : right[0]) &&
      (isNumber(left) ? left : left[1]) === (isNumber(right) ? right : right[1]))
  );
};

export const isPatchesEqual = <R>(
  left: readonly IPatchItem<R>[],
  right: readonly IPatchItem<R>[],
): boolean => {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((patch, index) => {
        const other = right[index];

        return (
          other !== undefined &&
          patch.key === other.key &&
          isPatchRangeEqual(patch.range, other.range) &&
          patch.render === other.render
        );
      }))
  );
};
