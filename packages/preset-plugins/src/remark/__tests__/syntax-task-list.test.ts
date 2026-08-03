import type { List, ListItem } from 'mdast';

import { describe, expect, test } from 'vitest';

import { SyntaxTaskListRemarkPlugin } from '../index';
import { collectTextValues, parseMarkdown } from './utils';

describe('SyntaxTaskListRemarkPlugin', () => {
  test('marks unchecked, checked, and ordinary list items', () => {
    const tree = parseMarkdown(['- [ ] todo', '- [x] done', '- ordinary'].join('\n'), [
      new SyntaxTaskListRemarkPlugin(),
    ]);
    const list = tree.children[0] as List;

    expect(list.children.map(({ checked }) => checked)).toEqual([false, true, null]);
    expect(collectTextValues(tree)).toEqual(['todo', 'done', 'ordinary']);
  });

  test('recognizes uppercase markers in nested task lists', () => {
    const tree = parseMarkdown(['- [x] parent', '  - [X] child'].join('\n'), [
      new SyntaxTaskListRemarkPlugin(),
    ]);
    const outer = tree.children[0] as List;
    const nested = outer.children[0]?.children.find((node): node is List => node.type === 'list');

    expect((outer.children[0] as ListItem).checked).toBe(true);
    expect(nested?.children[0]?.checked).toBe(true);
  });
});
