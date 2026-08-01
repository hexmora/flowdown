import type { Paragraph, Root } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { DanglingFootnoteRepairPlugin } from '../dangling-footnote';
import { paragraph, root, runRepairs } from './utils';

describe('DanglingFootnoteRepairPlugin', () => {
  test('exposes a matching stable key and ending-only late-stage config', () => {
    const plugin = new DanglingFootnoteRepairPlugin();

    expect(DanglingFootnoteRepairPlugin.key).toBe('repair-dangling-footnote');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Low,
    });
  });

  test.each(['first[', 'first[^12'])(
    'removes an incomplete footnote candidate from the structural tail',
    (value) => {
      const result = runRepairs(
        root([paragraph([{ type: 'text', value }])]),
        new DanglingFootnoteRepairPlugin(),
      );

      expect(first(result.children)).toMatchObject({
        type: 'paragraph',
        children: [{ type: 'text', value: 'first' }],
      });
    },
  );

  test('removes unresolved textual references while preserving parsed references', () => {
    const tree: Root = root([
      paragraph([
        { type: 'text', value: 'first[^missing] middle' },
        {
          type: 'footnoteReference',
          identifier: 'defined',
          label: 'defined',
        },
        { type: 'text', value: ' tail[^other]' },
      ]),
      {
        type: 'footnoteDefinition',
        identifier: 'defined',
        label: 'defined',
        children: [paragraph([{ type: 'text', value: 'definition' }])],
      },
    ]);
    const result = runRepairs(tree, new DanglingFootnoteRepairPlugin());
    const container = first(result.children) as Paragraph;

    expect(container.children).toEqual([
      { type: 'text', value: 'first middle' },
      {
        type: 'footnoteReference',
        identifier: 'defined',
        label: 'defined',
      },
      { type: 'text', value: ' tail' },
    ]);
  });

  test('does not change footnote-looking text inside a link', () => {
    const tree = root([
      paragraph([
        {
          type: 'link',
          url: '#',
          children: [{ type: 'text', value: '[^literal]' }],
        },
      ]),
    ]);

    expect(runRepairs(tree, new DanglingFootnoteRepairPlugin())).toEqual(tree);
  });

  test('keeps an escaped footnote-looking literal', () => {
    const tree = root([paragraph([{ type: 'text', value: '\\[^literal]' }])]);

    expect(runRepairs(tree, new DanglingFootnoteRepairPlugin())).toEqual(tree);
  });

  test.each(['literal [^invalid^label]', 'literal [^invalid^'])(
    'keeps a malformed footnote candidate containing another caret: %s',
    (value) => {
      const tree = root([paragraph([{ type: 'text', value }])]);

      expect(runRepairs(tree, new DanglingFootnoteRepairPlugin())).toEqual(tree);
    },
  );

  test('does not run outside ending mode', () => {
    const tree = root([paragraph([{ type: 'text', value: 'first[^missing]' }])]);

    expect(runRepairs(tree, new DanglingFootnoteRepairPlugin(), { ending: false })).toEqual(tree);
  });
});
