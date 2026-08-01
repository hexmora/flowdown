import type { Html, Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last, times } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { ParagraphHtmlClosureRepairPlugin } from '../paragraph-html-closure';
import { paragraph, root, runRepairs } from './utils';

const htmlValues = (node: Paragraph): string[] => {
  return node.children.filter((child) => child.type === 'html').map((child) => child.value);
};

describe('ParagraphHtmlClosureRepairPlugin', () => {
  test('exposes a matching stable key and late-stage config', () => {
    const plugin = new ParagraphHtmlClosureRepairPlugin();

    expect(ParagraphHtmlClosureRepairPlugin.key).toBe('repair-paragraph-html-closure');
    expect(plugin.config).toMatchObject({ priority: PluginPriority.Low });
    expect(plugin.config.ending).toBeFalsy();
  });

  test('does not close tags in the final paragraph', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'start' },
        { type: 'html', value: '<span>' },
        { type: 'text', value: 'tail' },
      ]),
    ]);

    expect(runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('closes unpaired tags in a non-final paragraph', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'start' },
        { type: 'html', value: '<span>' },
        { type: 'text', value: 'abc' },
        { type: 'html', value: '<em>' },
        { type: 'text', value: 'tail' },
      ]),
      paragraph([{ type: 'text', value: 'final' }]),
    ]);
    const result = runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), {
      ending: false,
    });
    const repaired = first(result.children) as Paragraph;

    expect(htmlValues(repaired)).toEqual(['<span>', '<em>', '</em>', '</span>']);
  });

  test('preserves nesting when some inner tags are already paired', () => {
    const tree = root([
      paragraph([
        { type: 'html', value: '<span>' },
        { type: 'html', value: '<em>' },
        { type: 'html', value: '<u>' },
        { type: 'text', value: 'content' },
        { type: 'html', value: '</u>' },
        { type: 'html', value: '</span>' },
      ]),
      paragraph([{ type: 'text', value: 'final' }]),
    ]);
    const result = runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), {
      ending: false,
    });
    const repaired = first(result.children) as Paragraph;

    expect(htmlValues(repaired)).toEqual(['<span>', '<em>', '<u>', '</u>', '</em>', '</span>']);
  });

  test('closes open tags before an unrelated closing tag boundary', () => {
    const tree = root([
      paragraph([
        { type: 'html', value: '<section>' },
        { type: 'text', value: 'content' },
        { type: 'html', value: '</aside>' },
        { type: 'text', value: 'tail' },
      ]),
      paragraph([{ type: 'text', value: 'next' }]),
    ]);
    const result = runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), {
      ending: false,
    });
    const repaired = first(result.children) as Paragraph;

    expect(repaired.children).toEqual([
      { type: 'html', value: '<section>' },
      { type: 'text', value: 'content' },
      { type: 'html', value: '</section>' },
      { type: 'html', value: '</aside>' },
      { type: 'text', value: 'tail' },
    ]);
  });

  test.each(['<img>', '<br>', '<hr>', '<input>'])(
    'does not synthesize an invalid closing tag for a void element',
    (html) => {
      const tree = root([
        paragraph([{ type: 'html', value: html }]),
        paragraph([{ type: 'text', value: 'final' }]),
      ]);
      const result = runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), {
        ending: false,
      });

      expect(first(result.children)).toEqual(first(tree.children));
    },
  );

  test('does not duplicate an existing matched closing tag', () => {
    const tree = root([
      paragraph([
        { type: 'html', value: '<SPAN class="value">' },
        { type: 'text', value: 'content' },
        { type: 'html', value: '</span>' },
      ]),
      paragraph([{ type: 'text', value: 'final' }]),
    ]);

    expect(runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('supports custom-element names and boolean attributes', () => {
    const tree = root([
      paragraph([
        { type: 'html', value: '<x-card2 open>' },
        { type: 'text', value: 'content' },
      ]),
      paragraph([{ type: 'text', value: 'final' }]),
    ]);
    const result = runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), {
      ending: false,
    });
    const repaired = first(result.children) as Paragraph;

    expect(last(repaired.children)).toEqual({ type: 'html', value: '</x-card2>' });
  });

  test('handles a wide, deeply nested HTML boundary without pathological slowdown', () => {
    const count = 2_000;
    const nested = times(
      count,
      (): Html => ({
        type: 'html',
        value: '<span>',
      }),
    );
    const tree = root([
      paragraph([...nested, { type: 'text', value: 'content' }]),
      paragraph([{ type: 'text', value: 'final' }]),
    ]);
    const result = runRepairs(tree, new ParagraphHtmlClosureRepairPlugin(), {
      ending: false,
    });
    const repaired = first(result.children) as Paragraph;

    expect(repaired.children).toHaveLength(count * 2 + 1);
    expect(last(repaired.children)).toEqual({ type: 'html', value: '</span>' });
  }, 2_000);
});
