import type { Heading } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { describe, expect, test } from 'vitest';

import { TrailingEmptyHeadingRepairPlugin } from '../trailing-empty-heading';
import { paragraph, root, runRepairs } from './utils';

describe('TrailingEmptyHeadingRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new TrailingEmptyHeadingRepairPlugin();

    expect(TrailingEmptyHeadingRepairPlugin.key).toBe('repair-trailing-empty-heading');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test.each<{ children: Heading['children'] }>([
    { children: [{ type: 'text', value: '   ' }] },
    { children: [] },
  ])('removes a trailing empty level-one heading', ({ children }) => {
    const tree = root([
      paragraph([{ type: 'text', value: 'prefix' }]),
      { type: 'heading', depth: 1, children },
    ]);
    const result = runRepairs(tree, new TrailingEmptyHeadingRepairPlugin());

    expect(result.children).toHaveLength(1);
  });

  test('keeps an empty heading of another depth', () => {
    const tree = root([{ type: 'heading', depth: 2, children: [{ type: 'text', value: ' ' }] }]);

    expect(runRepairs(tree, new TrailingEmptyHeadingRepairPlugin())).toEqual(tree);
  });

  test('keeps an empty level-one heading that is not last', () => {
    const tree = root([
      { type: 'heading', depth: 1, children: [] },
      paragraph([{ type: 'text', value: 'suffix' }]),
    ]);

    expect(runRepairs(tree, new TrailingEmptyHeadingRepairPlugin())).toEqual(tree);
  });

  test('keeps a non-empty trailing level-one heading', () => {
    const tree = root([
      { type: 'heading', depth: 1, children: [{ type: 'text', value: 'Heading' }] },
    ]);

    expect(runRepairs(tree, new TrailingEmptyHeadingRepairPlugin())).toEqual(tree);
  });
});
