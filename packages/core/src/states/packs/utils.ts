import type { IRawPatchItem } from '@flowdown/types';

import { isEqual } from 'lodash-es';

import type { IRenderPatchItem } from '../../externals';
import type { IPatchItem } from './type';

export interface Keyable {
  key: string;
}

export const isKeyablesEqual = <T extends Keyable>(left: T[], right: T[]): boolean => {
  return (
    left.length === right.length &&
    left.every((item, index) => item.key === right[index]?.key && isEqual(item, right[index]))
  );
};

export const splitPatches = <R>(patches: IPatchItem<R>[]) => {
  const usedKeys = patches.flatMap(({ key }) => (key === undefined ? [] : [key]));

  const rawPatches: IRawPatchItem[] = [];

  const renderPatches: IRenderPatchItem<R>[] = [];

  let fallbackIndex = 0;

  for (const { key: explicitKey, range, render } of patches) {
    let key = explicitKey;

    if (key === undefined) {
      key = String(fallbackIndex);

      fallbackIndex += 1;

      while (usedKeys.includes(key)) {
        key = `_${key}`;
      }

      usedKeys.push(key);
    }

    rawPatches.push({ key, range });

    renderPatches.push({ key, render });
  }

  return { rawPatches, renderPatches };
};
