import type { IRawPatchRange } from '@flowdown/types';

import { isSafeInteger, last, sortBy } from 'lodash-es';

import type { IRawPatchItem } from '../type';

type TextRange = {
  start: number;
  end: number;
};

export type ChunkedPatch<T extends IRawPatchItem> = Omit<T, 'range'> & {
  range: [number, number];
};

type OrderedPatch<T extends IRawPatchItem> = {
  patch: T;
  range: [number, number];
  order: number;
};

const toPatchRange = (range: IRawPatchRange): [number, number] => {
  return typeof range === 'number' ? [range, range] : range;
};

const isValidPatchRange = (start: number, end: number, textLength: number): boolean => {
  return (
    isSafeInteger(start) && isSafeInteger(end) && start >= 0 && start <= end && end <= textLength
  );
};

const findTextIndex = (
  ranges: TextRange[],
  start: number,
  end: number,
  textLength: number,
): number => {
  if (start === end) {
    if (start === textLength) {
      return ranges.length - 1;
    }

    return ranges.findIndex((range) => range.start <= start && start < range.end);
  }

  return ranges.findIndex((range) => range.start <= start && end <= range.end);
};

const patchesConflict = (
  left: OrderedPatch<IRawPatchItem>,
  right: OrderedPatch<IRawPatchItem>,
): boolean => {
  const [leftStart, leftEnd] = left.range;
  const [rightStart, rightEnd] = right.range;
  const leftIsPoint = leftStart === leftEnd;
  const rightIsPoint = rightStart === rightEnd;

  if (leftIsPoint && rightIsPoint) {
    return false;
  }

  if (leftIsPoint) {
    return rightStart <= leftStart && leftStart < rightEnd;
  }

  if (rightIsPoint) {
    return leftStart <= rightStart && rightStart < leftEnd;
  }

  return rightStart < leftEnd;
};

const filterPatches = <T extends IRawPatchItem>(patches: OrderedPatch<T>[]): ChunkedPatch<T>[] => {
  const result: OrderedPatch<T>[] = [];
  const sortedPatches = sortBy(
    patches,
    ({ range }) => range[0],
    ({ range }) => range[1],
    ({ order }) => order,
  );

  for (const patch of sortedPatches) {
    const previous = last(result);

    if (!previous || !patchesConflict(previous, patch)) {
      result.push(patch);
    }
  }

  const chunked: ChunkedPatch<T>[] = [];

  for (const { patch, range } of result) {
    chunked.push({ ...patch, range });
  }

  return chunked;
};

/** Splits document patches into block-local ranges aligned with the provided texts. */
export const chunkPatchesByTexts = <T extends IRawPatchItem>(
  patches: T[],
  texts: string[],
): ChunkedPatch<T>[][] => {
  let textLength = 0;
  const ranges = texts.map<TextRange>((text) => {
    const start = textLength;

    textLength += text.length;

    return { start, end: textLength };
  });
  const groups = texts.map((): OrderedPatch<T>[] => []);

  for (const [order, patch] of patches.entries()) {
    const [start, end] = toPatchRange(patch.range);

    if (!isValidPatchRange(start, end, textLength)) {
      continue;
    }

    const textIndex = findTextIndex(ranges, start, end, textLength);
    const range = ranges[textIndex];
    const group = groups[textIndex];

    if (!range || !group) {
      continue;
    }

    group.push({
      patch,
      range: [start - range.start, end - range.start],
      order,
    });
  }

  return groups.map(filterPatches);
};
