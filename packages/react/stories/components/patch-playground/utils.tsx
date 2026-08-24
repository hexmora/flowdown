import type { IPatchItem } from '@flowdown/core';
import type { ReactNode } from 'react';

import { assert } from '@flowdown/utils';

import { KEYLESS_ANCHOR, PATCH_MARKDOWN, POINT_ANCHOR, REPLACEMENT_ANCHOR } from './consts';

const getRange = (value: string, anchor: string): [number, number] => {
  const start = value.indexOf(anchor);

  assert(start >= 0);

  return [start, start + anchor.length];
};

const getPoint = (value: string, anchor: string): number => {
  const range = getRange(value, anchor);

  return range[1];
};

export const createPatches = (
  renderReplacement: (text?: string) => ReactNode,
): IPatchItem<ReactNode>[] => [
  {
    key: 'point-marker',
    range: getPoint(PATCH_MARKDOWN, POINT_ANCHOR),
    render: () => <sup aria-label="Point patch">◆</sup>,
  },
  {
    key: 'replacement-marker',
    range: getRange(PATCH_MARKDOWN, REPLACEMENT_ANCHOR),
    render: renderReplacement,
  },
  {
    range: getRange(PATCH_MARKDOWN, KEYLESS_ANCHOR),
    render: (text) => <mark>{text}</mark>,
  },
];
