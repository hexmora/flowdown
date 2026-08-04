import type { Code, Heading, Paragraph } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxPolicyRemarkPlugin } from '../index';
import { parseMarkdown } from './utils';

describe('SyntaxPolicyRemarkPlugin', () => {
  test('disables indented code and setext headings by default', () => {
    const indented = parseMarkdown('    alpha', [new SyntaxPolicyRemarkPlugin()]);
    const setext = parseMarkdown('Title\n=====', [new SyntaxPolicyRemarkPlugin()]);

    expect(indented.children[0]?.type).toBe('paragraph');
    expect((indented.children[0] as Paragraph).children[0]).toMatchObject({
      type: 'text',
      value: 'alpha',
    });
    expect(setext.children[0]?.type).toBe('paragraph');
  });

  test('captures independent constructor switches for both parser features', () => {
    const indented = parseMarkdown('    alpha', [
      new SyntaxPolicyRemarkPlugin({ indentedCode: true }),
    ]);
    const equals = parseMarkdown('Title\n=====', [
      new SyntaxPolicyRemarkPlugin({ setextHeading: true }),
    ]);
    const dashes = parseMarkdown('Title\n-----', [
      new SyntaxPolicyRemarkPlugin({ setextHeading: true }),
    ]);

    expect(indented.children[0]).toMatchObject<Partial<Code>>({
      type: 'code',
      value: 'alpha',
    });
    expect(equals.children[0]).toMatchObject<Partial<Heading>>({ type: 'heading', depth: 1 });
    expect(dashes.children[0]).toMatchObject<Partial<Heading>>({ type: 'heading', depth: 2 });
  });

  test('does not affect fenced code or ATX headings', () => {
    const tree = parseMarkdown(['# Heading', '', '```ts', 'value', '```'].join('\n'), [
      new SyntaxPolicyRemarkPlugin(),
    ]);

    expect(tree.children.map((node) => node.type)).toEqual(['heading', 'code']);
  });
});
