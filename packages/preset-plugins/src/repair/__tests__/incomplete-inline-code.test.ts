import type { Paragraph, Root } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteInlineCodeRepairPlugin } from '../incomplete-inline-code';
import { paragraph, root, runRepairs } from './utils';

const repairParagraph = (children: Paragraph['children']): Paragraph => {
  const result = runRepairs(root([paragraph(children)]), new IncompleteInlineCodeRepairPlugin());
  const repaired = first(result.children);

  expect(repaired?.type).toBe('paragraph');

  return repaired as Paragraph;
};

const nonTextualTails: Paragraph['children'] = [
  { type: 'image', url: '/tail.png', alt: 'tail' },
  { type: 'break' },
];

describe('IncompleteInlineCodeRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new IncompleteInlineCodeRepairPlugin();

    expect(IncompleteInlineCodeRepairPlugin.key).toBe('repair-incomplete-inline-code');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('repairs a tail delimiter with text on both sides', () => {
    const result = repairParagraph([
      { type: 'inlineCode', value: 'stable' },
      { type: 'text', value: 'before' },
      { type: 'text', value: 'prefix`suffix' },
      { type: 'html', value: '<span />' },
      { type: 'text', value: 'tail' },
    ]);

    expect(result.children).toEqual([
      { type: 'inlineCode', value: 'stable' },
      { type: 'text', value: 'before' },
      { type: 'text', value: 'prefix' },
      { type: 'inlineCode', value: 'suffix<span />tail' },
    ]);
  });

  test('repairs a tail delimiter without a prefix', () => {
    const result = repairParagraph([
      { type: 'text', value: '`suffix' },
      { type: 'html', value: '<span />' },
      { type: 'text', value: 'tail' },
    ]);

    expect(result.children).toEqual([{ type: 'inlineCode', value: 'suffix<span />tail' }]);
  });

  test('repairs a delimiter whose content comes entirely from following textual nodes', () => {
    const result = repairParagraph([
      { type: 'text', value: '`' },
      { type: 'html', value: '<span />' },
      { type: 'text', value: 'tail' },
    ]);

    expect(result.children).toEqual([{ type: 'inlineCode', value: '<span />tail' }]);
  });

  test('removes an empty delimiter at the actual container tail', () => {
    const result = repairParagraph([{ type: 'text', value: 'prefix`' }]);

    expect(result.children).toEqual([{ type: 'text', value: 'prefix' }]);
  });

  test('does not repair when another inline-code node follows the candidate', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'prefix`suffix' },
        { type: 'inlineCode', value: 'later' },
        { type: 'text', value: 'tail' },
      ]),
    ]);

    expect(runRepairs(tree, new IncompleteInlineCodeRepairPlugin())).toEqual(tree);
  });

  test('does not repair a candidate outside the structural tail branch', () => {
    const tree: Root = root([
      paragraph([{ type: 'text', value: 'prefix`suffix' }]),
      paragraph([{ type: 'text', value: 'actual tail' }]),
    ]);

    expect(runRepairs(tree, new IncompleteInlineCodeRepairPlugin())).toEqual(tree);
  });

  test.each(nonTextualTails)(
    'does not drop a non-textual tail node while attempting repair',
    (tail) => {
      const tree = root([paragraph([{ type: 'text', value: 'prefix`suffix' }, tail])]);

      expect(runRepairs(tree, new IncompleteInlineCodeRepairPlugin())).toEqual(tree);
    },
  );

  test('keeps an escaped single backtick as text', () => {
    const tree = root([paragraph([{ type: 'text', value: 'prefix\\`suffix' }])]);

    expect(runRepairs(tree, new IncompleteInlineCodeRepairPlugin())).toEqual(tree);
  });
});
