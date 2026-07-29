import type { Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteStrongRepairPlugin } from '../incomplete-strong';
import { paragraph, root, runRepairs } from './utils';

const repairParagraph = (children: Paragraph['children']): Paragraph => {
  const result = runRepairs(root([paragraph(children)]), new IncompleteStrongRepairPlugin());
  const repaired = first(result.children);

  expect(repaired?.type).toBe('paragraph');

  return repaired as Paragraph;
};

describe('IncompleteStrongRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new IncompleteStrongRepairPlugin();

    expect(IncompleteStrongRepairPlugin.key).toBe('repair-incomplete-strong');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test.each([
    ['123__456', '123', '456'],
    ['123**456', '123', '456'],
  ])('repairs an incomplete strong suffix', (value, prefix, suffix) => {
    const result = repairParagraph([
      { type: 'text', value: 'first' },
      { type: 'inlineCode', value: 'stable' },
      { type: 'text', value },
    ]);

    expect(result.children).toEqual([
      { type: 'text', value: 'first' },
      { type: 'inlineCode', value: 'stable' },
      { type: 'text', value: prefix },
      { type: 'strong', children: [{ type: 'text', value: suffix }] },
    ]);
  });

  test('repairs the parser shape produced by a dangling double asterisk', () => {
    const result = repairParagraph([
      { type: 'text', value: 'prefix*' },
      { type: 'emphasis', children: [{ type: 'text', value: 'suffix' }] },
    ]);

    expect(result.children).toEqual([
      { type: 'text', value: 'prefix' },
      { type: 'strong', children: [{ type: 'text', value: 'suffix' }] },
    ]);
  });

  test('removes the empty trailing list artifact associated with an incomplete marker', () => {
    const tree = root([
      paragraph([{ type: 'text', value: 'prefix' }]),
      {
        type: 'list',
        ordered: false,
        children: [{ type: 'listItem', children: [] }],
      },
    ]);
    const result = runRepairs(tree, new IncompleteStrongRepairPlugin());

    expect(result.children).toEqual([paragraph([{ type: 'text', value: 'prefix' }])]);
  });

  test('keeps complete tail content unchanged', () => {
    const tree = root([paragraph([{ type: 'text', value: 'complete' }])]);

    expect(runRepairs(tree, new IncompleteStrongRepairPlugin())).toEqual(tree);
  });

  test('keeps a candidate that is not at the structural tail', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: '123__456' },
        { type: 'inlineCode', value: 'later' },
      ]),
    ]);

    expect(runRepairs(tree, new IncompleteStrongRepairPlugin())).toEqual(tree);
  });

  test('keeps the same candidate outside a paragraph', () => {
    const tree = root([
      { type: 'heading', depth: 1, children: [{ type: 'text', value: '123__456' }] },
    ]);

    expect(runRepairs(tree, new IncompleteStrongRepairPlugin())).toEqual(tree);
  });

  test.each(['value ** suffix', 'value__suffix', 'value \\**suffix'])(
    'does not force an invalid or escaped delimiter into strong content',
    (value) => {
      const tree = root([paragraph([{ type: 'text', value }])]);

      expect(runRepairs(tree, new IncompleteStrongRepairPlugin())).toEqual(tree);
    },
  );
});
