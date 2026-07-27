import type { Root } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteCodeFenceRepairPlugin } from '../incomplete-code-fence';
import { paragraph, repairMarkdown, root, runRepairs } from './utils';

describe('IncompleteCodeFenceRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new IncompleteCodeFenceRepairPlugin();

    expect(IncompleteCodeFenceRepairPlugin.key).toBe('repair-incomplete-code-fence');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('removes a partial closing fence parsed into a trailing code block', () => {
    const tree: Root = root([
      paragraph([{ type: 'text', value: 'prefix' }]),
      { type: 'code', value: 'console.log(123)\n``' },
    ]);
    const result = runRepairs(tree, new IncompleteCodeFenceRepairPlugin());

    expect(last(result.children)).toMatchObject({
      type: 'code',
      value: 'console.log(123)',
    });
  });

  test.each([
    ['tail\n`', 'tail\n'],
    ['tail\n``', 'tail\n'],
  ])('removes a partial opening fence parsed as tail text', (value, expected) => {
    const tree = root([paragraph([{ type: 'text', value }])]);
    const result = runRepairs(tree, new IncompleteCodeFenceRepairPlugin());
    const container = first(result.children);

    expect(container?.type === 'paragraph' ? last(container.children) : undefined).toMatchObject({
      type: 'text',
      value: expected,
    });
  });

  test.each([
    ['start\n```\ncode\n``', 'code'],
    ['start\n```\ncode\n`', 'code'],
    ['start\n```\ncode\n', 'code'],
    ['start\n```\nco', 'co'],
  ])('normalizes an incomplete fenced-code markdown tail', (source, expected) => {
    const result = repairMarkdown(source, new IncompleteCodeFenceRepairPlugin());

    expect(last(result.children)).toMatchObject({ type: 'code', value: expected });
  });

  test('keeps a complete fenced code block unchanged', () => {
    const source = '```ts\nconst value = 1;\n```';
    const tree = repairMarkdown(source, new IncompleteCodeFenceRepairPlugin(), {
      ending: false,
    });

    expect(runRepairs(tree, new IncompleteCodeFenceRepairPlugin())).toEqual(tree);
  });

  test('does not treat tilde code content as a partial backtick fence', () => {
    const tree = root([{ type: 'code', value: 'content\n~~', lang: null, meta: null }]);

    expect(runRepairs(tree, new IncompleteCodeFenceRepairPlugin())).toEqual(tree);
  });

  test('keeps legitimate inline backticks at the end of code content', () => {
    const tree = root([{ type: 'code', value: 'const marker = ``', lang: 'ts' }]);

    expect(runRepairs(tree, new IncompleteCodeFenceRepairPlugin())).toEqual(tree);
  });
});
