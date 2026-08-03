import type { Element } from 'hast';
import type { Root, Table } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxTableRemarkPlugin, TableNoralizerRemarkPlugin } from '../index';
import {
  findHastElement,
  markdownToHast,
  parseMarkdown,
  runRemarkPlugin,
  stripPositions,
} from './utils';

const SOURCE_WITH_WIDER_BODY = ['| Header |', '| :---: |', '| first | second |'].join('\n');

const firstTable = (tree: Root): Table => tree.children[0] as Table;

const elementChildren = (node: Element, tagName: string): Element[] => {
  return node.children.filter(
    (child): child is Element => child.type === 'element' && child.tagName === tagName,
  );
};

describe('TableNoralizerRemarkPlugin', () => {
  test('pads align to the widest parsed row while preserving existing alignment', () => {
    const tree = parseMarkdown(SOURCE_WITH_WIDER_BODY, [
      new SyntaxTableRemarkPlugin(),
      new TableNoralizerRemarkPlugin(),
    ]);
    const table = firstTable(tree);

    expect(table.align).toEqual(['center', null]);
    expect(table.children.map((row) => row.children.length)).toEqual([1, 2]);
  });

  test('preserves the extra body cell and creates an empty header cell in HAST', () => {
    const tree = markdownToHast({
      text: SOURCE_WITH_WIDER_BODY,
      remarks: [new SyntaxTableRemarkPlugin(), new TableNoralizerRemarkPlugin()],
    });
    const table = findHastElement(tree, 'table');
    const head = table && elementChildren(table, 'thead')[0];
    const body = table && elementChildren(table, 'tbody')[0];
    const headerRow = head && elementChildren(head, 'tr')[0];
    const bodyRow = body && elementChildren(body, 'tr')[0];
    const headerCells = headerRow ? elementChildren(headerRow, 'th') : [];
    const bodyCells = bodyRow ? elementChildren(bodyRow, 'td') : [];

    expect(headerCells).toHaveLength(2);
    expect(headerCells[1]?.children).toEqual([]);
    expect(bodyCells).toHaveLength(2);
    expect(bodyCells[1]?.children[0]).toMatchObject({ type: 'text', value: 'second' });
  });

  test('does not modify a regular table', () => {
    const source = ['| a | b |', '| - | - |', '| c | d |'].join('\n');
    const baseline = parseMarkdown(source, [new SyntaxTableRemarkPlugin()]);
    const normalized = parseMarkdown(source, [
      new SyntaxTableRemarkPlugin(),
      new TableNoralizerRemarkPlugin(),
    ]);

    expect(stripPositions(normalized)).toEqual(stripPositions(baseline));
  });

  test('does not shrink an align array that already covers the widest row', () => {
    const source = ['| a | b |', '| - | - |', '| c |'].join('\n');
    const baseline = parseMarkdown(source, [new SyntaxTableRemarkPlugin()]);
    const normalized = parseMarkdown(source, [
      new SyntaxTableRemarkPlugin(),
      new TableNoralizerRemarkPlugin(),
    ]);

    expect(stripPositions(normalized)).toEqual(stripPositions(baseline));
  });

  test('leaves an empty table unchanged', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'table', align: [], children: [] }],
    };

    runRemarkPlugin(tree, new TableNoralizerRemarkPlugin());

    expect(tree.children[0]).toEqual({ type: 'table', align: [], children: [] });
  });
});
