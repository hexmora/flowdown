import type { Table } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxTableRemarkPlugin } from '../index';
import { parseMarkdown, stripPositions } from './utils';

describe('SyntaxTableRemarkPlugin', () => {
  test('parses pipe tables, optional outer pipes, and column alignment', () => {
    const tree = parseMarkdown(['Name | Score', ':--- | ---:', 'Ada | 10'].join('\n'), [
      new SyntaxTableRemarkPlugin(),
    ]);
    const table = tree.children[0] as Table;

    expect(table.type).toBe('table');
    expect(table.align).toEqual(['left', 'right']);
    expect(table.children.map((row) => row.children.length)).toEqual([2, 2]);
  });

  test('parses a header-only table and leaves an invalid delimiter as a paragraph', () => {
    const headerOnly = parseMarkdown(['| A | B |', '| - | - |'].join('\n'), [
      new SyntaxTableRemarkPlugin(),
    ]);
    const invalid = parseMarkdown(['| A | B |', '| x | y |'].join('\n'), [
      new SyntaxTableRemarkPlugin(),
    ]);

    expect(stripPositions(headerOnly.children[0])).toMatchObject({
      type: 'table',
      children: [{ type: 'tableRow' }],
    });
    expect(invalid.children[0]?.type).toBe('paragraph');
  });
});
