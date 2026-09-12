import type { IPluggable, IRemarkPlugin } from '@fluxdown/types';

import { PRESET_MAPPER_PLUGINS, Shad, Smooth } from '@fluxdown/core-presets/mapper';
import { PRESET_REHYPE_PLUGINS } from '@fluxdown/core-presets/rehype';
import { PRESET_REMARK_PLUGINS, SyntaxMathRemarkPlugin } from '@fluxdown/core-presets/remark';
import { PRESET_REPAIR_PLUGINS } from '@fluxdown/core-presets/repair';

import { mergePluginPluggables } from '../states/packs/states/utils';

describe('core preset imports', () => {
  test('resolves plugins through their public type entry points', () => {
    expect(typeof Smooth).toBe('function');

    expect(PRESET_MAPPER_PLUGINS).toEqual([Smooth, Shad]);

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
