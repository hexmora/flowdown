import type { Paragraph } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxStrikethroughRemarkPlugin } from '../index';
import { parseMarkdown } from './utils';

const childTypes = (singleTilde?: boolean) => {
  const plugin =
    singleTilde === undefined
      ? new SyntaxStrikethroughRemarkPlugin()
      : new SyntaxStrikethroughRemarkPlugin({ singleTilde });
  const tree = parseMarkdown('~~double~~ and ~single~', [plugin]);

  return (tree.children[0] as Paragraph).children.map((node) => node.type);
};

describe('SyntaxStrikethroughRemarkPlugin', () => {
  test('uses the upstream default that accepts single and double tildes', () => {
    expect(childTypes()).toEqual(['delete', 'text', 'delete']);
  });

  test('captures constructor configuration and can require double tildes', () => {
    expect(childTypes(false)).toEqual(['delete', 'text']);

    const tree = parseMarkdown('~~Hi~~Hello', [
      new SyntaxStrikethroughRemarkPlugin({ singleTilde: false }),
    ]);
    const paragraph = tree.children[0] as Paragraph;

    expect(paragraph.children[0]).toMatchObject({ type: 'delete' });
  });
});
