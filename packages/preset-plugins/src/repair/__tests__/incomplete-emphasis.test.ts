import type { Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteEmphasisRepairPlugin } from '../incomplete-emphasis';
import { paragraph, root, runRepairs } from './utils';

const repairParagraph = (children: Paragraph['children']): Paragraph => {
  const result = runRepairs(root([paragraph(children)]), new IncompleteEmphasisRepairPlugin());
  const repaired = first(result.children);

  expect(repaired?.type).toBe('paragraph');

  return repaired as Paragraph;
};

describe('IncompleteEmphasisRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new IncompleteEmphasisRepairPlugin();

    expect(IncompleteEmphasisRepairPlugin.key).toBe('repair-incomplete-emphasis');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('repairs an incomplete emphasis suffix in the tail paragraph', () => {
    const result = repairParagraph([
      { type: 'text', value: 'first' },
      { type: 'inlineCode', value: 'stable' },
      { type: 'text', value: '123*456' },
    ]);

    expect(result.children).toEqual([
      { type: 'text', value: 'first' },
      { type: 'inlineCode', value: 'stable' },
      { type: 'text', value: '123' },
      { type: 'emphasis', children: [{ type: 'text', value: '456' }] },
    ]);
  });

  test('repairs an opening delimiter preceded by whitespace when its suffix is valid', () => {
    const result = repairParagraph([{ type: 'text', value: 'prefix *suffix' }]);

    expect(result.children).toEqual([
      { type: 'text', value: 'prefix ' },
      { type: 'emphasis', children: [{ type: 'text', value: 'suffix' }] },
    ]);
  });

  test('removes an empty trailing emphasis marker', () => {
    const result = repairParagraph([{ type: 'text', value: 'prefix*' }]);

    expect(result.children).toEqual([{ type: 'text', value: 'prefix' }]);
  });

  test('keeps complete tail content unchanged', () => {
    const tree = root([paragraph([{ type: 'text', value: 'complete' }])]);

    expect(runRepairs(tree, new IncompleteEmphasisRepairPlugin())).toEqual(tree);
  });

  test('keeps a candidate that is not at the structural tail', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: '123*456' },
        { type: 'inlineCode', value: 'later' },
      ]),
    ]);

    expect(runRepairs(tree, new IncompleteEmphasisRepairPlugin())).toEqual(tree);
  });

  test('keeps the same candidate outside a paragraph', () => {
    const tree = root([
      { type: 'heading', depth: 1, children: [{ type: 'text', value: '123*456' }] },
    ]);

    expect(runRepairs(tree, new IncompleteEmphasisRepairPlugin())).toEqual(tree);
  });

  test.each(['2 * 3', 'prefix * suffix', 'prefix \\*suffix'])(
    'does not force an invalid or escaped delimiter into emphasis content',
    (value) => {
      const tree = root([paragraph([{ type: 'text', value }])]);

      expect(runRepairs(tree, new IncompleteEmphasisRepairPlugin())).toEqual(tree);
    },
  );
});
