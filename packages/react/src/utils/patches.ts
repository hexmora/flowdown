import type { IPatchItem } from '@flowdown/core';
import type { IRawPatchRange } from '@flowdown/types';

import { isNumber } from 'lodash-es';

const isPatchRangeEqual = (left: IRawPatchRange, right: IRawPatchRange): boolean => {
  if (left === right) {
    return true;
  }

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
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((patch, index) => {
    const other = right[index];

    if (other === undefined) {
      return false;
    }

    const equalities = [
      patch.key === other.key,

      isPatchRangeEqual(patch.range, other.range),

      patch.render === other.render,
    ];

    return equalities.every((item) => item);
  });
};
