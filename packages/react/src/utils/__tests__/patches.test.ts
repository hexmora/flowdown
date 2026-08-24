import type { IPatchItem } from '@flowdown/core';

import { describe, expect, test } from 'vitest';

import { isPatchesEqual } from '..';

const renderPatch = () => null;

describe('isPatchesEqual', () => {
  test('treats a numeric point and its zero-width tuple as the same range', () => {
    const numeric: IPatchItem<null>[] = [{ key: 'point', range: 1, render: renderPatch }];

    const tuple: IPatchItem<null>[] = [{ key: 'point', range: [1, 1], render: renderPatch }];

    expect(isPatchesEqual(numeric, tuple)).toBe(true);

    expect(isPatchesEqual(tuple, numeric)).toBe(true);
  });
});
