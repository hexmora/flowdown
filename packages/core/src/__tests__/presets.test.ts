import type { IPluggable, IRemarkPlugin } from '@flowdown/types';

import { Smooth } from '@flowdown/core-presets/mapper';
import { PRESET_REHYPE_PLUGINS } from '@flowdown/core-presets/rehype';
import { PRESET_REMARK_PLUGINS, SyntaxMathRemarkPlugin } from '@flowdown/core-presets/remark';
import { PRESET_REPAIR_PLUGINS } from '@flowdown/core-presets/repair';
import { describe, expect, test } from 'vitest';

import { mergePluginPluggables } from '../states/packs/states/utils';

describe('core preset imports', () => {
  test('resolves plugins through their public type entry points', () => {
    expect(Smooth).toBeTypeOf('function');

    expect(PRESET_REHYPE_PLUGINS.length).toBeGreaterThan(0);

    expect(PRESET_REMARK_PLUGINS).toContain(SyntaxMathRemarkPlugin);

    expect(PRESET_REPAIR_PLUGINS.length).toBeGreaterThan(0);
  });

  test('replaces an internal preset when the override comes from the public entry point', () => {
    const override: IPluggable<IRemarkPlugin, { repairEnding: boolean }> = [
      SyntaxMathRemarkPlugin,
      { repairEnding: true },
    ];

    const merged = mergePluginPluggables<IPluggable<IRemarkPlugin, unknown>>(
      PRESET_REMARK_PLUGINS,
      [override],
    );

    expect(merged.filter((item) => item === SyntaxMathRemarkPlugin)).toEqual([]);

    expect(merged).toContain(override);
  });
});
