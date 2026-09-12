import { PluginPriority } from '@fluxdown/types';
import { uniq } from 'lodash-es';

import {
  HoistFootnoteRehypePlugin,
  PRESET_REHYPE_PLUGINS,
  RawParserRehypePlugin,
  SanitizerRehypePlugin,
} from '..';

describe('rehype plugin contracts', () => {
  test('exposes unique stable keys for all built-in plugins', () => {
    const keys = PRESET_REHYPE_PLUGINS.map((PluginClass) => PluginClass.key);

    expect(keys).toEqual(['rehype-raw-parser', 'rehype-sanitizer', 'rehype-hoist-footnote']);
    expect(uniq(keys)).toHaveLength(keys.length);
  });

  test('runs all built-in rehype plugins in the final priority bucket', () => {
    expect(new RawParserRehypePlugin().config.priority).toBe(PluginPriority.Lowest);
    expect(new SanitizerRehypePlugin().config.priority).toBe(PluginPriority.Lowest);
    expect(new HoistFootnoteRehypePlugin().config.priority).toBe(PluginPriority.Lowest);
  });
});
