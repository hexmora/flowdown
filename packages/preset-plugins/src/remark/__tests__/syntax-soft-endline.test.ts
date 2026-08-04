import type { Paragraph } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxSoftEndlineRemarkPlugin } from '../index';
import { collectTextValues, parseMarkdown } from './utils';

describe('SyntaxSoftEndlineRemarkPlugin', () => {
  test('turns soft line endings between phrasing nodes into break nodes', () => {
    const markdown = [
      '*Italic with asterisks*',
      '_Italic with underscores_',
      '**Bold with asterisks**',
      '__Bold with underscores__',
    ].join('\n');
    const tree = parseMarkdown(markdown, [new SyntaxSoftEndlineRemarkPlugin()]);
    const paragraph = tree.children[0] as Paragraph;

    expect(paragraph.children.map((node) => node.type)).toEqual([
      'emphasis',
      'break',
      'emphasis',
      'break',
      'strong',
      'break',
      'strong',
    ]);
    expect(paragraph.children.filter((node) => node.type === 'break')).toHaveLength(3);
    expect(collectTextValues(tree).some((value) => value.includes('\n'))).toBe(false);
  });

  test('handles CRLF without joining paragraphs or changing code literals', () => {
    const paragraphs = parseMarkdown('first\r\nsecond\r\n\r\nthird', [
      new SyntaxSoftEndlineRemarkPlugin(),
    ]);
    const code = parseMarkdown(['```txt', 'first', 'second', '```'].join('\n'), [
      new SyntaxSoftEndlineRemarkPlugin(),
    ]);

    expect(paragraphs.children).toHaveLength(2);
    expect((paragraphs.children[0] as Paragraph).children.map((node) => node.type)).toEqual([
      'text',
      'break',
      'text',
    ]);
    expect(code.children[0]).toMatchObject({ type: 'code', value: 'first\nsecond' });
  });
});
