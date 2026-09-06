import * as presetExports from '@flowdown/core/presets';
import * as pluginExports from '@flowdown/preset-plugins';
import { describe, expect, test } from 'vitest';

import { mergePluginPluggables } from '../states/packs/states/utils';

describe('core preset exports', () => {
  test('re-exports the complete preset package without changing plugin identities', () => {
    const presets = { ...presetExports };
    const plugins = { ...pluginExports };

    expect(Object.keys(presets)).toEqual(Object.keys(plugins));

    for (const key of Object.keys(plugins) as (keyof typeof plugins)[]) {
      expect(presets[key]).toBe(plugins[key]);
    }
  });

  test('replaces an internal preset when the override comes from the public subpath', () => {
    const override = presetExports.SyntaxMathRemarkPlugin;
    const merged = mergePluginPluggables([pluginExports.SyntaxMathRemarkPlugin], [override]);

    expect(merged).toEqual([override]);
  });
});
