import type { FootnoteDefinition, FootnoteReference, Paragraph } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxFootnoteRemarkPlugin } from '../index';
import { parseMarkdown, stripPositions } from './utils';

describe('SyntaxFootnoteRemarkPlugin', () => {
  test('parses references and multi-paragraph definitions with normalized identifiers', () => {
    const tree = parseMarkdown(
      ['Statement[^Note].', '', '[^Note]: First paragraph.', '', '    Second paragraph.'].join(
        '\n',
      ),
      [new SyntaxFootnoteRemarkPlugin()],
    );
    const paragraph = tree.children[0] as Paragraph;
    const reference = paragraph.children.find(
      (node): node is FootnoteReference => node.type === 'footnoteReference',
    );
    const definition = tree.children.find(
      (node): node is FootnoteDefinition => node.type === 'footnoteDefinition',
    );

    expect(stripPositions(reference)).toEqual({
      type: 'footnoteReference',
      identifier: 'note',
      label: 'Note',
    });
    expect(definition).toMatchObject({ identifier: 'note', label: 'Note' });
    expect(definition?.children).toHaveLength(2);
  });
});
