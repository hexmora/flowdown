import type { Paragraph, Root, Text } from 'mdast';

import { describe, expect, test } from 'vitest';

import { RawParserRehypePlugin, SanitizerRehypePlugin } from '../../rehype';
import { SyntaxHtmlAllowedRemarkPlugin } from '../index';
import { findHastElement, markdownToHast, parseMarkdown, runRemarkPlugin } from './utils';

const parseWithAllowlist = (text: string, enabledTags?: string[] | boolean): Root => {
  return parseMarkdown(text, [new SyntaxHtmlAllowedRemarkPlugin({ enabledTags })]);
};

const firstParagraph = (tree: Root): Paragraph => tree.children[0] as Paragraph;

const htmlValues = (paragraph: Paragraph): string[] => {
  return paragraph.children.filter((node) => node.type === 'html').map((node) => node.value);
};

const legacyTagCases: Array<[string, Paragraph['children'][number]['type']]> = [
  ['<div hidden>', 'html'],
  ['<div id = "x">', 'html'],
  ['</div >', 'html'],
  ['<my_tag>', 'text'],
  ['</div><span>', 'html'],
];

const transformHtmlNode = (value: string): Paragraph['children'][number] => {
  const tree: Root = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'html', value }] }],
  };

  runRemarkPlugin(tree, new SyntaxHtmlAllowedRemarkPlugin());

  return firstParagraph(tree).children[0] as Paragraph['children'][number];
};

describe('SyntaxHtmlAllowedRemarkPlugin', () => {
  test('does nothing to a tree without children', () => {
    const node: Text = { type: 'text', value: 'hello' };

    runRemarkPlugin(node, new SyntaxHtmlAllowedRemarkPlugin());

    expect(node).toEqual({ type: 'text', value: 'hello' });
  });

  test('downgrades disabled start and end tags to text without losing source', () => {
    const paragraph = firstParagraph(parseWithAllowlist('a<div>hello</div>b'));
    const text = paragraph.children
      .filter((node) => node.type === 'text')
      .map((node) => node.value)
      .join('');

    expect(text).toContain('<div>');
    expect(text).toContain('hello');
    expect(text).toContain('</div>');
    expect(paragraph.children.some((node) => node.type === 'html')).toBe(false);
  });

  test('snapshots the enabled tag list at construction', () => {
    const enabledTags = ['span'];
    const plugin = new SyntaxHtmlAllowedRemarkPlugin({ enabledTags });

    enabledTags.push('div');

    const paragraph = firstParagraph(parseMarkdown('<span>x</span><div>y</div>', [plugin]));
    const raw = htmlValues(paragraph).join('');

    expect(raw).toContain('<span>');
    expect(raw).not.toContain('<div>');
  });

  test('keeps raw HTML whose tag name cannot be identified', () => {
    const paragraph = firstParagraph(parseWithAllowlist('a<!-- comment -->b'));

    expect(htmlValues(paragraph).join('')).toContain('<!-- comment -->');
  });

  test.each(legacyTagCases)('preserves legacy tag detection for %s', (value, expectedType) => {
    expect(transformHtmlNode(value)).toEqual({ type: expectedType, value });
  });

  test('skips sparse child entries without throwing', () => {
    const children: Paragraph['children'] = [{ type: 'html', value: '<div>x</div>' }];

    children.length = 2;

    const tree: Root = {
      type: 'root',
      children: [{ type: 'paragraph', children }],
    };

    expect(() => runRemarkPlugin(tree, new SyntaxHtmlAllowedRemarkPlugin())).not.toThrow();
    expect(firstParagraph(tree).children.some((node) => node?.type === 'html')).toBe(false);
  });

  test('keeps every default tag as raw HTML', () => {
    const paragraph = firstParagraph(
      parseWithAllowlist(
        '<span>x</span><u>y</u><br/><em>z</em><a href="https://example.com">a</a>',
      ),
    );
    const raw = htmlValues(paragraph).join('');

    expect(raw).toContain('<span>');
    expect(raw).toContain('<u>');
    expect(raw).toContain('<br');
    expect(raw).toContain('<em>');
    expect(raw).toContain('<a ');
  });

  test('captures enabledTags=true and allows every identifiable tag', () => {
    const paragraph = firstParagraph(parseWithAllowlist('<my-widget>x</my-widget>', true));

    expect(htmlValues(paragraph).join('')).toContain('my-widget');
  });

  test('treats an enabledTags array as an extension of the defaults', () => {
    const paragraph = firstParagraph(
      parseWithAllowlist('<span>x</span><my-widget>y</my-widget>', ['my-widget']),
    );
    const raw = htmlValues(paragraph).join('');

    expect(raw).toContain('span');
    expect(raw).toContain('my-widget');
  });

  test('captures enabledTags=false and disables even the default tags', () => {
    const paragraph = firstParagraph(parseWithAllowlist('<span>x</span>', false));

    expect(paragraph.children.some((node) => node.type === 'html')).toBe(false);
    expect(
      paragraph.children
        .filter((node) => node.type === 'text')
        .map((node) => node.value)
        .join(''),
    ).toContain('<span>');
  });

  test('downgrades disallowed HTML before raw parsing instead of relying on sanitization', () => {
    const text = '<div>content</div>';
    const sanitized = markdownToHast({
      text,
      rehypes: [new RawParserRehypePlugin(), new SanitizerRehypePlugin()],
    });
    const downgraded = markdownToHast({
      text,
      remarks: [new SyntaxHtmlAllowedRemarkPlugin()],
      rehypes: [new RawParserRehypePlugin(), new SanitizerRehypePlugin()],
    });

    expect(findHastElement(sanitized, 'div')).toBeDefined();
    expect(findHastElement(downgraded, 'div')).toBeUndefined();
    expect(downgraded.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', value: '<div>content</div>' }),
      ]),
    );
  });
});
