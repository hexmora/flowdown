import type { IPatchItem } from '@flowdown/core';

import { describe, expect, test } from 'vitest';

import { isPatchesEqual } from '..';

const renderPatch = () => null;

describe('isPatchesEqual', () => {
  test('short-circuits identical patch collections before reading their values', () => {
    const patches = new Proxy<IPatchItem<null>[]>(
      [{ key: 'point', range: 1, render: renderPatch }],
      {
        get: () => {
          throw new Error('Patch values must not be read.');
        },
      },
    );

    expect(isPatchesEqual(patches, patches)).toBe(true);
  });

  test('short-circuits identical range references before reading their bounds', () => {
    const range = new Proxy<[number, number]>([1, 2], {
      get: () => {
        throw new Error('Range bounds must not be read.');
      },
    });

    const left: IPatchItem<null>[] = [{ key: 'range', range, render: renderPatch }];

    const right: IPatchItem<null>[] = [{ key: 'range', range, render: renderPatch }];

    expect(isPatchesEqual(left, right)).toBe(true);
  });

  test('treats a numeric point and its zero-width tuple as the same range', () => {
    const numeric: IPatchItem<null>[] = [{ key: 'point', range: 1, render: renderPatch }];

    const tuple: IPatchItem<null>[] = [{ key: 'point', range: [1, 1], render: renderPatch }];

    expect(isPatchesEqual(numeric, tuple)).toBe(true);

    expect(isPatchesEqual(tuple, numeric)).toBe(true);
  });
});
