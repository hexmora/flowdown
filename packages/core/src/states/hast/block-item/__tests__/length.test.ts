import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { Plugin } from 'unified';

import { getLengthOfHast } from '@flowdown/utils';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTable } from 'micromark-extension-gfm-table';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { markdownToHast } from '../../block-compiler/utils';

const root = (children: RootContent[]): Root => ({
  type: 'root',
  children,
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

describe('compiled HAST length', () => {
  test('ignores generated table whitespace and missing trailing cells', () => {
    const tree = parseTable('| A | B | C |\n| --- | --- | --- |\n| 1');

    expect(getLengthOfHast(tree)).toBe(4);
  });

  test('ignores explicitly empty table cells', () => {
    const tree = parseTable('| A |   | C |\n| --- | --- | --- |\n| 1 | 2 | |');

    expect(getLengthOfHast(tree)).toBe(4);
    expect(getLengthOfHast(root([element('td'), element('TH')]))).toBe(0);
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
});
