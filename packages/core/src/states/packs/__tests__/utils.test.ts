import type { IRawPatchItem } from '@flowdown/types';

import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IRenderPatchItem } from '../../../externals/base-renderer';

import { type IPatchItem, isKeyablesEqual, splitPatches, toRawPatches, toRenderPatches } from '..';

const renderPatch = () => 'rendered';

const renderFirst = () => 'first';

const renderSecond = () => 'second';

describe('patch utilities', () => {
  test('splits raw and render fields while preserving render functions', () => {
    const render = vi.fn(() => 'rendered');
    const patches: IPatchItem<string>[] = [
      { key: 'named', range: [1, 3], render },
      { range: 4, render },
    ];

    const { rawPatches, renderPatches } = splitPatches(patches);

    expect(rawPatches).toEqual([
      { key: 'named', range: [1, 3] },
      { key: '0', range: 4 },
    ]);
    expect(renderPatches).toEqual([
      { key: 'named', render },
      { key: '0', render },
    ]);
    expect(toRawPatches(patches)).toEqual(rawPatches);
    expect(toRenderPatches(patches)).toEqual(renderPatches);
    expectTypeOf(rawPatches).toEqualTypeOf<IRawPatchItem[]>();
    expectTypeOf(renderPatches).toEqualTypeOf<IRenderPatchItem<string>[]>();
  });

  test('indexes only keyless patches so keyed insertions keep fallback keys stable', () => {
    const keyless: IPatchItem<string>[] = [
      { range: 1, render: renderPatch },
      { range: 2, render: renderPatch },
    ];
    const withKeyedInsertion: IPatchItem<string>[] = [
      keyless[0]!,
      { key: 'named', range: 3, render: renderPatch },
      keyless[1]!,
    ];

    const original = splitPatches(keyless);
    const inserted = splitPatches(withKeyedInsertion);

    expect(original.rawPatches.map(({ key }) => key)).toEqual(['0', '1']);
    expect(original.renderPatches.map(({ key }) => key)).toEqual(['0', '1']);
    expect(inserted.rawPatches.map(({ key }) => key)).toEqual(['0', 'named', '1']);
    expect(inserted.renderPatches.map(({ key }) => key)).toEqual(['0', 'named', '1']);
  });

  test('prefixes fallback keys until they do not conflict', () => {
    const { rawPatches, renderPatches } = splitPatches<string>([
      { range: 1, render: renderPatch },
      { key: '0', range: 2, render: renderPatch },
      { key: '_0', range: 3, render: renderPatch },
      { key: '__0', range: 4, render: renderPatch },
    ]);

    expect(rawPatches[0]?.key).toBe('___0');
    expect(renderPatches[0]?.key).toBe('___0');
    expect(isKeyablesEqual(rawPatches, [...rawPatches.slice(1), rawPatches[0]!])).toBe(false);
    expect(isKeyablesEqual(rawPatches, rawPatches.slice(1))).toBe(false);
  });

  test('compares keyed patch values as well as their ordered keys', () => {
    const patches: IPatchItem<string>[] = [{ key: 'stable', range: [1, 2], render: renderFirst }];

    expect(isKeyablesEqual(toRawPatches(patches), toRawPatches([...patches]))).toBe(true);
    expect(
      isKeyablesEqual(
        toRawPatches(patches),
        toRawPatches([{ key: 'stable', range: [2, 3], render: renderFirst }]),
      ),
    ).toBe(false);
    expect(
      isKeyablesEqual(
        toRenderPatches(patches),
        toRenderPatches([{ key: 'stable', range: [1, 2], render: renderSecond }]),
      ),
    ).toBe(false);
  });
});
