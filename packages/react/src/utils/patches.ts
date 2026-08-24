import type { IPatchItem } from '@flowdown/core';
import type { IRawPatchRange } from '@flowdown/types';

import { isNumber } from 'lodash-es';

const isPatchRangeEqual = (left: IRawPatchRange, right: IRawPatchRange): boolean => {
  const leftStart = isNumber(left) ? left : left[0];

  const leftEnd = isNumber(left) ? left : left[1];

  const rightStart = isNumber(right) ? right : right[0];

  const rightEnd = isNumber(right) ? right : right[1];

  return leftStart === rightStart && leftEnd === rightEnd;
};

export const isPatchesEqual = <R>(
  left: readonly IPatchItem<R>[],
  right: readonly IPatchItem<R>[],
): boolean => {
  return (
    left.length === right.length &&
    left.every((patch, index) => {
      const other = right[index];

      return (
        other !== undefined &&
        patch.key === other.key &&
        isPatchRangeEqual(patch.range, other.range) &&
        patch.render === other.render
      );
    })
  );
};
