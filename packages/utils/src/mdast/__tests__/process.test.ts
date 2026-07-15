import type {
  BlockContent,
  Blockquote,
  DefinitionContent,
  Root,
  RootContent,
  ThematicBreak,
} from 'mdast';

import { describe, expect, test } from 'vitest';

import { processMdast, type ProcessMdastParams } from '../process';

declare module 'mdast' {
  interface Data {
    id?: string;
  }
}

type NodeLike = {
  type: string;
  data?: unknown;
};

type BlockChild = BlockContent | DefinitionContent;

type VisitOptions = Pick<ProcessMdastParams<Root | RootContent>, 'order' | 'rightFirst'>;

const root = (children: BlockChild[]): Root => ({
  type: 'root',
  data: { id: 'root' },
  children,
});

const branch = (id: string, children: BlockChild[]): Blockquote => ({
  type: 'blockquote',
  data: { id },
  children,
});

const leaf = (id: string): ThematicBreak => ({
  type: 'thematicBreak',
  data: { id },
});

const nodeId = (node: NodeLike) => {
  const data = node.data as { id?: string } | undefined;

  return data?.id ?? node.type;
};

const collectVisits = (ast: Root | RootContent, options?: VisitOptions) => {
  const visits: string[] = [];

  processMdast({
    node: ast,
    runner: ({ node }) => {
      visits.push(nodeId(node));
    },
    ...options,
  });

  return visits;
};

describe('processMdast', () => {
  test('visits nodes in depth-first pre-order from left to right by default', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);

    expect(collectVisits(ast)).toEqual(['root', 'a', 'quote', 'b', 'c', 'd']);
  });

  test('visits right siblings first while keeping pre-order parent-child order', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);

    expect(collectVisits(ast, { rightFirst: true })).toEqual(['root', 'd', 'quote', 'c', 'b', 'a']);
  });

  test('visits children before parents in post-order', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);

    expect(collectVisits(ast, { order: 'post' })).toEqual(['a', 'b', 'c', 'quote', 'd', 'root']);
  });

  test('visits right siblings first in post-order', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);

    expect(collectVisits(ast, { order: 'post', rightFirst: true })).toEqual([
      'd',
      'c',
      'b',
      'quote',
      'a',
      'root',
    ]);
  });

  test('visits non-leaf nodes on the second encounter in in-order traversal', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);

    expect(collectVisits(ast, { order: 'in' })).toEqual(['a', 'root', 'b', 'quote', 'c', 'd']);
  });

  test('visits right siblings first in in-order traversal', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);

    expect(collectVisits(ast, { order: 'in', rightFirst: true })).toEqual([
      'd',
      'root',
      'c',
      'quote',
      'b',
      'a',
    ]);
  });

  test('reports parent, parent chain, and live index for each visit', () => {
    const ast = root([branch('outer', [leaf('before'), branch('inner', [leaf('target')])])]);
    const metadata: Record<
      string,
      {
        index: number | undefined;
        parent: string | undefined;
        parents: string[];
      }
    > = {};

    processMdast({
      node: ast,
      runner: ({ node, index, parent, parents }) => {
        metadata[nodeId(node)] = {
          index,
          parent: parent ? nodeId(parent) : undefined,
          parents: parents.map(nodeId),
        };
      },
    });

    expect(metadata.root).toEqual({
      index: undefined,
      parent: undefined,
      parents: [],
    });
    expect(metadata.outer).toEqual({
      index: 0,
      parent: 'root',
      parents: ['root'],
    });
    expect(metadata.inner).toEqual({
      index: 1,
      parent: 'outer',
      parents: ['outer', 'root'],
    });
    expect(metadata.target).toEqual({
      index: 0,
      parent: 'inner',
      parents: ['inner', 'outer', 'root'],
    });
  });

  test('visits a standalone non-parent node', () => {
    expect(collectVisits(leaf('single'))).toEqual(['single']);
  });

  test('breaks traversal synchronously when break is called', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b'), leaf('c')]), leaf('d')]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, break: breakWalk }) => {
        visits.push(nodeId(node));

        if (nodeId(node) === 'quote') {
          breakWalk();
        }
      },
    });

    expect(visits).toEqual(['root', 'a', 'quote']);
  });

  test('breaks post-order traversal before later ancestors and siblings', () => {
    const ast = root([leaf('a'), branch('quote', [leaf('b')]), leaf('d')]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, break: breakWalk }) => {
        visits.push(nodeId(node));

        if (nodeId(node) === 'quote') {
          breakWalk();
        }
      },
      order: 'post',
    });

    expect(visits).toEqual(['a', 'b', 'quote']);
  });

  test('skips descendants in pre-order traversal with skipTree', () => {
    const ast = root([branch('skipped', [leaf('a'), leaf('b')]), branch('visited', [leaf('c')])]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, skipTree }) => {
        visits.push(nodeId(node));

        if (nodeId(node) === 'skipped') {
          skipTree();
        }
      },
    });

    expect(visits).toEqual(['root', 'skipped', 'visited', 'c']);
  });

  test('does not skip already-visited descendants in post-order traversal with skipTree', () => {
    const ast = root([branch('quote', [leaf('a')]), leaf('b')]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, skipTree }) => {
        visits.push(nodeId(node));

        if (nodeId(node) === 'quote') {
          skipTree();
        }
      },
      order: 'post',
    });

    expect(visits).toEqual(['a', 'quote', 'b', 'root']);
  });

  test('requires break and skipTree to be called during traversal', () => {
    const ast = root([leaf('a')]);
    let breakAfterTraversal: (() => void) | undefined;
    let skipTreeAfterTraversal: (() => void) | undefined;

    processMdast({
      node: ast,
      runner: ({ break: breakWalk, skipTree }) => {
        breakAfterTraversal = breakWalk;
        skipTreeAfterTraversal = skipTree;
      },
    });

    expect(breakAfterTraversal).toBeTypeOf('function');
    expect(skipTreeAfterTraversal).toBeTypeOf('function');
    expect(() => {
      breakAfterTraversal?.();
    }).toThrow('processMdast: break must be called during a visit');
    expect(() => {
      skipTreeAfterTraversal?.();
    }).toThrow('processMdast: skipTree must be called during a visit');
  });

  test('inserts siblings after the current node without visiting them in pre-order traversal', () => {
    const ast = root([leaf('a'), leaf('b')]);
    const visits: string[] = [];
    const indices: Record<string, number | undefined> = {};

    processMdast({
      node: ast,
      runner: ({ node, index, insertNext }) => {
        const id = nodeId(node);
        visits.push(id);
        indices[id] = index;

        if (id === 'a') {
          insertNext([leaf('x'), leaf('y')]);
        }
      },
    });

    expect(visits).toEqual(['root', 'a', 'b']);
    expect(ast.children.map(nodeId)).toEqual(['a', 'x', 'y', 'b']);
    expect(indices).toMatchObject({
      a: 0,
      b: 3,
    });
  });

  test('replaces the current node without visiting replacements in pre-order traversal', () => {
    const ast = root([leaf('a'), leaf('b')]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, insertNext }) => {
        const id = nodeId(node);
        visits.push(id);

        if (id === 'a') {
          insertNext([leaf('x'), leaf('y')], true);
        }
      },
    });

    expect(visits).toEqual(['root', 'a', 'b']);
    expect(ast.children.map(nodeId)).toEqual(['x', 'y', 'b']);
  });

  test('ignores insertions requested for the root node', () => {
    const ast = root([leaf('a')]);

    processMdast({
      node: ast,
      runner: ({ node, insertNext }) => {
        if (nodeId(node) === 'root') {
          insertNext([leaf('x')]);
        }
      },
    });

    expect(ast.children.map(nodeId)).toEqual(['a']);
  });

  test('does not visit a scheduled node that was removed before its turn', () => {
    const ast = root([leaf('a'), leaf('b'), leaf('c')]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, parent }) => {
        const id = nodeId(node);
        visits.push(id);

        if (id === 'a' && parent) {
          const index = parent.children.findIndex((child) => nodeId(child) === 'b');

          parent.children.splice(index, 1);
        }
      },
    });

    expect(visits).toEqual(['root', 'a', 'c']);
    expect(ast.children.map(nodeId)).toEqual(['a', 'c']);
  });

  test('includes siblings inserted before a parent is revisited in post-order traversal', () => {
    const ast = root([leaf('a'), leaf('b')]);
    const visits: string[] = [];

    processMdast({
      node: ast,
      runner: ({ node, insertNext }) => {
        const id = nodeId(node);
        visits.push(id);

        if (id === 'a') {
          insertNext([leaf('x')]);
        }
      },
      order: 'post',
    });

    expect(visits).toEqual(['a', 'b', 'x', 'root']);
    expect(ast.children.map(nodeId)).toEqual(['a', 'x', 'b']);
  });
});
