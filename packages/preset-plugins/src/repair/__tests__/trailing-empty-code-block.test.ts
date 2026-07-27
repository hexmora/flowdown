import type { Code } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { TrailingEmptyCodeBlockRepairPlugin } from '../trailing-empty-code-block';
import { paragraph, root, runRepairs } from './utils';

describe('TrailingEmptyCodeBlockRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new TrailingEmptyCodeBlockRepairPlugin();

    expect(TrailingEmptyCodeBlockRepairPlugin.key).toBe('repair-trailing-empty-code-block');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('removes a completely empty trailing code block', () => {
    const tree = root([
      paragraph([{ type: 'text', value: 'prefix' }]),
      { type: 'code', value: '', lang: '', meta: '' },
    ]);
    const result = runRepairs(tree, new TrailingEmptyCodeBlockRepairPlugin());

    expect(result.children).toHaveLength(1);
    expect(last(result.children)).toMatchObject({ type: 'paragraph' });
  });

  test('keeps the same empty block when it is not the structural tail', () => {
    const tree = root([
      { type: 'code', value: '', lang: '', meta: '' },
      paragraph([{ type: 'text', value: 'suffix' }]),
    ]);

    expect(runRepairs(tree, new TrailingEmptyCodeBlockRepairPlugin())).toEqual(tree);
  });

  test.each<Code>([
    { type: 'code', value: 'content', lang: '', meta: '' },
    { type: 'code', value: '', lang: 'ts', meta: '' },
    { type: 'code', value: '', lang: '', meta: 'title=example' },
  ])('keeps a trailing code block with observable content or metadata', (code) => {
    const tree = root([code]);

    expect(runRepairs(tree, new TrailingEmptyCodeBlockRepairPlugin())).toEqual(tree);
  });
});
