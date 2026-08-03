import type { Link, Paragraph } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxAutolinkRemarkPlugin } from '../index';
import { parseMarkdown } from './utils';

describe('SyntaxAutolinkRemarkPlugin', () => {
  test('parses bare web and email addresses without losing display text', () => {
    const tree = parseMarkdown('https://example.com/a_b www.example.com person@example.com', [
      new SyntaxAutolinkRemarkPlugin(),
    ]);
    const paragraph = tree.children[0] as Paragraph;
    const links = paragraph.children.filter((node): node is Link => node.type === 'link');

    expect(links.map(({ url }) => url)).toEqual([
      'https://example.com/a_b',
      'http://www.example.com',
      'mailto:person@example.com',
    ]);
    expect(
      links.map((link) =>
        link.children.map((child) => (child.type === 'text' ? child.value : '')).join(''),
      ),
    ).toEqual(['https://example.com/a_b', 'www.example.com', 'person@example.com']);
  });

  test('leaves an incomplete email candidate as text', () => {
    const tree = parseMarkdown('{person@example', [new SyntaxAutolinkRemarkPlugin()]);
    const paragraph = tree.children[0] as Paragraph;

    expect(paragraph.children).toEqual([
      expect.objectContaining({ type: 'text', value: '{person@example' }),
    ]);
  });
});
