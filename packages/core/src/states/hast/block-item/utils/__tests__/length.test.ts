import type { Element, ElementContent, Root, RootContent, Text } from 'hast';
import type { Plugin } from 'unified';

import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, test, vi } from 'vitest';

import { findVisibleIndex, getLengthOfHast } from '..';
import { markdownToHast } from '../../../block-compiler/utils';

const root = (children: RootContent[]): Root => ({
  type: 'root',
  children,
});

const text = (value: string): Text => ({
  type: 'text',
  value,
});

const element = (tagName: string, children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

const gfmTablePlugin: Plugin = function () {
  const data = this.data();

  (data.micromarkExtensions ??= []).push(gfmTable());
  (data.fromMarkdownExtensions ??= []).push(gfmTableFromMarkdown());
};

const tableProcessor = unified().use(remarkParse).use(gfmTablePlugin).use(remarkRehype);

const parseTable = (source: string): Root => {
  const tree = tableProcessor.parse(source);

  return tableProcessor.runSync(tree, source) as Root;
};

const COMPLEX_TABLE_SOURCE = `| 学号 | 姓名 | 语文 | 数学 | 英语 | 综合 | 总分 | 平均分 | 班级排名 | 等级 |
|-----|-----|-----|-----|-----|-----|-----|--------|----------|------|
| 01 | 陈明 | 92 | 98 | 94 | 88 | 372 | 93.00 | 1 | A |
| 02 | 李华 | 85 | 92 | 89 | 90 | 356 | 89.00 | 3 | B |
| 03 | 王芳 | 88 | 85 | 91 | 93 | 357 | 89.25 | 2 | B |
| 04 | 赵强 | 76 | 82 | 78 | 80 | 316 | 79.00 | 8 | C |
| 05 | 刘佳 | 90 | 86 | 92 | 87 | 355 | 88.75 | 4 | B |`;

describe('getLengthOfHast', () => {
  test('counts text as Unicode grapheme clusters', () => {
    expect(typeof Intl.Segmenter).toBe('function');
    expect(getLengthOfHast(root([]))).toBe(0);
    expect(getLengthOfHast(root([text('abc'), text('中文'), text('a\nb')]))).toBe(8);
    expect(getLengthOfHast(root([text('👨‍👩‍👧‍👦🇨🇳👍🏽e\u0301')]))).toBe(4);
    expect(getLengthOfHast(root([text('\n')]))).toBe(1);
  });

  test('falls back to Unicode code point counting without Intl.Segmenter', async () => {
    const intl = Intl as unknown as {
      Segmenter?: typeof Intl.Segmenter;
    };
    const originalSegmenter = intl.Segmenter;
    const value = 'A👨‍👩‍👧‍👦🇨🇳👍🏽e\u0301B';

    try {
      intl.Segmenter = undefined;
      vi.resetModules();

      const { getLengthOfHast: getLengthWithoutSegmenter } = await import('..');

      expect(getLengthWithoutSegmenter(root([text(value)]))).toBe([...value].length);
    } finally {
      intl.Segmenter = originalSegmenter;
      vi.resetModules();
    }
  });

  test('falls back safely when Intl is unavailable', async () => {
    const value = '👨‍👩‍👧‍👦A';

    try {
      vi.stubGlobal('Intl', undefined);
      vi.resetModules();

      const { getLengthOfHast: getLengthWithoutIntl } = await import('../length');

      expect(getLengthWithoutIntl(root([text(value)]))).toBe([...value].length);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });

  test('ignores script, style, and template subtrees', () => {
    const tree = root([
      element('script'),
      element('style', [text('hidden styles')]),
      element('template', [element('img'), text('hidden template')]),
      element('SCRIPT', [text('case-insensitive')]),
    ]);

    expect(getLengthOfHast(tree)).toBe(0);
  });

  test('counts every visible empty element as one character', () => {
    const tree = root([element('img'), element('br'), element('span'), element('custom-tag')]);

    expect(getLengthOfHast(tree)).toBe(4);
  });

  test('counts children without adding length for non-leaf elements', () => {
    const tree = root([element('p', [text('BC'), element('br'), text('D')])]);

    expect(getLengthOfHast(tree)).toBe(4);
  });

  test('counts visible content in a mixed tree', () => {
    const tree = root([
      text('A'),
      element('img'),
      element('p', [text('BC'), element('br'), text('D')]),
      element('script', [text('ignored')]),
      element('span'),
      text('EF'),
    ]);

    expect(getLengthOfHast(tree)).toBe(9);
  });

  test('is independent of visible node order and nesting structure', () => {
    const flat = root([text('A'), element('img'), text('B')]);
    const nested = root([
      element('div', [text('B'), element('span', [text('A')]), element('img')]),
    ]);

    expect(getLengthOfHast(flat)).toBe(3);
    expect(getLengthOfHast(nested)).toBe(3);
  });

  test('ignores comments, doctypes, and empty text nodes', () => {
    const tree = root([
      { type: 'doctype' },
      { type: 'comment', value: 'hidden comment' },
      text(''),
      text('visible'),
    ]);

    expect(getLengthOfHast(tree)).toBe(7);
  });

  test('ignores generated table whitespace and missing trailing cells', () => {
    const tree = parseTable('| A | B | C |\n| --- | --- | --- |\n| 1');

    expect(getLengthOfHast(tree)).toBe(4);
  });

  test('ignores explicitly empty table cells', () => {
    const tree = parseTable('| A |   | C |\n| --- | --- | --- |\n| 1 | 2 | |');

    expect(getLengthOfHast(tree)).toBe(4);
    expect(getLengthOfHast(root([element('td'), element('TH')]))).toBe(0);
  });

  test('does not count empty table structure as visible content', () => {
    const tree = root([
      element('table', [
        text('\n'),
        element('caption'),
        element('colgroup', [
          text('\n  '),
          element('col', [text('not column content')]),
          text('\n'),
        ]),
        element('thead'),
        element('tbody', [element('tr')]),
        element('tfoot'),
      ]),
    ]);

    expect(getLengthOfHast(tree)).toBe(0);
  });

  test('filters table layout whitespace without hiding nested content', () => {
    const tree = root([
      text('\r\n  '),
      element('table', [
        text('\r\n  '),
        element('tbody', [
          text('\n\n'),
          element('tr', [
            text(' \r\n '),
            element('td', [element('pre', [text('\n')])]),
            element('td'),
          ]),
        ]),
      ]),
      text('\n '),
    ]);

    expect(getLengthOfHast(tree)).toBe(1);
  });

  test('keeps line breaks that are unrelated to a table sibling', () => {
    const tree = root([
      element('p', [text('A')]),
      text('\n'),
      element('p', [text('B')]),
      element('table', [element('tbody', [element('tr', [element('td', [text('C')])])])]),
    ]);

    expect(getLengthOfHast(tree)).toBe(4);
  });

  test('treats empty text as transparent around table whitespace', () => {
    const table = element('table', [
      element('tbody', [element('tr', [element('td', [text('A')])])]),
    ]);

    expect(getLengthOfHast(root([table, text('\n')]))).toBe(1);
    expect(getLengthOfHast(root([table, text(''), text('\n')]))).toBe(1);
  });

  test('does not accumulate generated whitespace in partial tables', () => {
    const lengths = [160, 220, 300, 380].map((size) => {
      return getLengthOfHast(parseTable(COMPLEX_TABLE_SOURCE.slice(0, size)));
    });

    expect(lengths).toEqual([37, 62, 93, 126]);
  });

  test('counts non-table separators from parsed Markdown', () => {
    const tree = markdownToHast({
      text: 'Hello **世界**\n\n👨‍👩‍👧‍👦',
    });

    expect(getLengthOfHast(tree)).toBe(10);
  });

  test('handles deeply nested trees without recursive traversal', () => {
    let child: ElementContent = element('img');

    for (let depth = 0; depth < 10_000; depth += 1) {
      child = element('div', [child]);
    }

    expect(getLengthOfHast(root([child]))).toBe(1);
  });
});

describe('findVisibleIndex', () => {
  test('normalizes positions before the first visible character', () => {
    expect(findVisibleIndex([1, 2, 3], 0)).toEqual({ blockIndex: 0, localIndex: 0 });
    expect(findVisibleIndex([1, 2, 3], -10)).toEqual({ blockIndex: 0, localIndex: 0 });
  });

  test('maps visible positions to block-local positions', () => {
    expect(findVisibleIndex([3, 5], 1)).toEqual({ blockIndex: 0, localIndex: 1 });
    expect(findVisibleIndex([3, 5], 3)).toEqual({ blockIndex: 1, localIndex: 0 });
    expect(findVisibleIndex([3, 5], 7)).toEqual({ blockIndex: 1, localIndex: 4 });
  });

  test('returns null when no existing block contains the position', () => {
    expect(findVisibleIndex([], 0)).toBeNull();
    expect(findVisibleIndex([3, 5], Number.NaN)).toBeNull();
    expect(findVisibleIndex([3, 5], 8)).toBeNull();
    expect(findVisibleIndex([3, 5], 999)).toBeNull();
  });

  test('handles zero, invalid, and sparse block lengths as empty blocks', () => {
    expect(findVisibleIndex([0, 2, 0, 3], 2)).toEqual({ blockIndex: 3, localIndex: 0 });
    expect(findVisibleIndex([-2, Number.NaN, 3], 1)).toEqual({
      blockIndex: 2,
      localIndex: 1,
    });

    const sparse: number[] = [];
    sparse.length = 3;
    sparse[2] = 3;

    expect(findVisibleIndex(sparse, 1)).toEqual({ blockIndex: 2, localIndex: 1 });
  });
});
