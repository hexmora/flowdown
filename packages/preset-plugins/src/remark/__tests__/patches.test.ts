import type { IRawPatchItem, IRemarkPlugin } from '@flowdown/types';
import type { Element, Nodes as HastNode, Root as HastRoot, Text as HastText } from 'hast';
import type {
  List,
  ListItem,
  Node as MdastNode,
  Root as MdastRoot,
  Paragraph,
  RootContent,
  Strong,
  Text,
} from 'mdast';

import { assert } from '@flowdown/utils';
import { cloneDeep, first, floor, last, nth } from 'lodash-es';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import type { ParserPatch } from '../../typings';

import { PatchesRemarkPlugin, type PatchesRemarkPluginConfig } from '../patches';
import { SyntaxMathRemarkPlugin } from '../syntax-math';
import { SyntaxTableRemarkPlugin } from '../syntax-table';
import { markdownToHast, parseMarkdown, runRemarkPlugin, stripPositions, walkMdast } from './utils';

type MdastWalkNode = MdastRoot | RootContent;

const parseWithPatches = (
  text: string,
  patches: IRawPatchItem[],
  remarks: IRemarkPlugin[] = [new PatchesRemarkPlugin({ patches })],
): MdastRoot => parseMarkdown(text, remarks);

const parseTableWithPatches = (text: string, patches: IRawPatchItem[]): MdastRoot =>
  parseWithPatches(text, patches, [
    new SyntaxTableRemarkPlugin(),
    new PatchesRemarkPlugin({ patches }),
  ]);

const parseHastWithPatches = (text: string, patches: IRawPatchItem[]): HastRoot =>
  markdownToHast({
    text,
    remarks: [new PatchesRemarkPlugin({ patches })],
  });

const getParagraph = (root: MdastRoot): Paragraph => {
  const node = first(root.children);

  expect(node?.type).toBe('paragraph');
  assert(node?.type === 'paragraph');

  return node;
};

const getStrong = (node: RootContent | undefined): Strong => {
  expect(node?.type).toBe('strong');
  assert(node?.type === 'strong');

  return node;
};

const getList = (node: RootContent | undefined): List => {
  expect(node?.type).toBe('list');
  assert(node?.type === 'list');

  return node;
};

const getListItem = (node: ListItem | undefined): ListItem => {
  expect(node?.type).toBe('listItem');
  assert(node?.type === 'listItem');

  return node;
};

const getText = (node: RootContent | undefined): Text => {
  expect(node?.type).toBe('text');
  assert(node?.type === 'text');

  return node;
};

const getParserPatch = (node: RootContent | undefined): ParserPatch => {
  expect(node?.type).toBe('parserPatch');
  assert(node?.type === 'parserPatch');

  return node;
};

const collectParserPatches = (root: MdastWalkNode): ParserPatch[] => {
  const patches: ParserPatch[] = [];

  walkMdast(root, (node) => {
    if (node.type === 'parserPatch') {
      patches.push(node);
    }
  });

  return patches;
};

const findMdastNode = <T extends MdastWalkNode['type']>(
  root: MdastWalkNode,
  type: T,
  predicate: (node: Extract<MdastWalkNode, { type: T }>) => boolean = () => true,
): Extract<MdastWalkNode, { type: T }> | undefined => {
  let result: Extract<MdastWalkNode, { type: T }> | undefined;

  walkMdast(root, (node) => {
    if (node.type !== type) {
      return;
    }

    const typedNode = node as Extract<MdastWalkNode, { type: T }>;

    if (!result && predicate(typedNode)) {
      result = typedNode;
    }
  });

  return result;
};

const getOffsetRange = (node: MdastNode): [number, number] => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;

  expect(start).toBeTypeOf('number');
  expect(end).toBeTypeOf('number');
  assert(start !== undefined && end !== undefined);

  return [start, end];
};

const getHastElement = (node: HastNode | undefined, tagName?: string): Element => {
  expect(node?.type).toBe('element');
  assert(node?.type === 'element');

  if (tagName) {
    expect(node.tagName).toBe(tagName);
  }

  return node;
};

const getHastText = (node: HastNode | undefined): HastText => {
  expect(node?.type).toBe('text');
  assert(node?.type === 'text');

  return node;
};

const findHastElementIndex = (root: HastRoot, tagName: string): number =>
  root.children.findIndex((node) => node.type === 'element' && node.tagName === tagName);

describe('PatchesRemarkPlugin', () => {
  describe('configuration', () => {
    test.each([
      {
        name: 'omitted patches',
        plugin: () => new PatchesRemarkPlugin(),
      },
      {
        name: 'an empty patch list',
        plugin: () => new PatchesRemarkPlugin({ patches: [] }),
      },
    ])('is a no-op with $name', ({ plugin }) => {
      const baseline = parseMarkdown('hello', []);
      const actual = parseMarkdown('hello', [plugin()]);

      expect(stripPositions(actual)).toEqual(stripPositions(baseline));
    });

    test('does not mutate its config or patches', () => {
      const patches: IRawPatchItem[] = [
        { key: 'point', range: 1 },
        { key: 'replacement', range: [2, 4] },
      ];
      const config: PatchesRemarkPluginConfig = { patches };
      const originalConfig = cloneDeep(config);

      parseMarkdown('hello', [new PatchesRemarkPlugin(config)]);

      expect(config).toEqual(originalConfig);
      expect(config.patches).toBe(patches);
    });

    test('snapshots its patch config at construction', () => {
      const config: PatchesRemarkPluginConfig = {
        patches: [{ key: 'initial', range: 1 }],
      };
      const plugin = new PatchesRemarkPlugin(config);

      config.patches?.push({ key: 'late', range: 3 });

      expect(
        collectParserPatches(parseMarkdown('hello', [plugin])).map((patch) => patch.data.key),
      ).toEqual(['initial']);
    });
  });

  describe('text patches', () => {
    test.each([
      {
        name: 'tuple range',
        range: [2, 2] as [number, number],
      },
      {
        name: 'numeric range',
        range: 2,
      },
    ])('supports a point patch expressed as a $name', ({ range }) => {
      const paragraph = getParagraph(parseWithPatches('hello', [{ key: 'point', range }]));

      expect(paragraph.children.map((node) => node.type)).toEqual(['text', 'parserPatch', 'text']);
      expect(getText(first(paragraph.children)).value).toBe('he');
      expect(getParserPatch(nth(paragraph.children, 1)).data.key).toBe('point');
      expect(getText(nth(paragraph.children, 2)).value).toBe('llo');
    });

    test('places a point patch before paragraph text', () => {
      const paragraph = getParagraph(parseWithPatches('hello', [{ key: 'start', range: [0, 0] }]));

      expect(paragraph.children.map((node) => node.type)).toEqual(['parserPatch', 'text']);
      expect(getParserPatch(first(paragraph.children)).data.key).toBe('start');
      expect(getText(nth(paragraph.children, 1)).value).toBe('hello');
    });

    test('replaces a text range and preserves the replaced text', () => {
      const paragraph = getParagraph(
        parseWithPatches('hello', [{ key: 'replacement', range: [1, 4] }]),
      );
      const patch = getParserPatch(nth(paragraph.children, 1));

      expect(paragraph.children.map((node) => node.type)).toEqual(['text', 'parserPatch', 'text']);
      expect(getText(first(paragraph.children)).value).toBe('h');
      expect(patch.data.key).toBe('replacement');
      expect(patch.data.hProperties.dataPatchText).toBe('ell');
      expect(getText(nth(paragraph.children, 2)).value).toBe('o');
    });

    test('replaces an entire text node without leaving empty text siblings', () => {
      const paragraph = getParagraph(parseWithPatches('hello', [{ key: 'all', range: [0, 5] }]));

      expect(paragraph.children).toHaveLength(1);
      expect(getParserPatch(first(paragraph.children)).data.hProperties.dataPatchText).toBe(
        'hello',
      );
    });

    test('preserves declaration order for patches at the same point', () => {
      const paragraph = getParagraph(
        parseWithPatches('hello', [
          { key: 'first', range: [2, 2] },
          { key: 'second', range: [2, 2] },
        ]),
      );

      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual([
        'first',
        'second',
      ]);
    });

    test('orders non-overlapping patches by source while preserving equal-point order', () => {
      const paragraph = getParagraph(
        parseWithPatches('abcdef', [
          { key: 'late', range: [4, 5] },
          { key: 'same-1', range: [1, 1] },
          { key: 'same-2', range: [1, 1] },
          { key: 'middle', range: [2, 3] },
        ]),
      );

      expect(paragraph.children.map((node) => node.type)).toEqual([
        'text',
        'parserPatch',
        'parserPatch',
        'text',
        'parserPatch',
        'text',
        'parserPatch',
        'text',
      ]);
      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual([
        'same-1',
        'same-2',
        'middle',
        'late',
      ]);
      expect(
        collectParserPatches(paragraph).map(({ data }) => data.hProperties.dataPatchText),
      ).toEqual([undefined, undefined, 'c', 'e']);
    });

    test.each([
      {
        name: 'replacement first',
        patches: [
          { key: 'replacement', range: [2, 4] as [number, number] },
          { key: 'point', range: [2, 2] as [number, number] },
        ],
      },
      {
        name: 'point first',
        patches: [
          { key: 'point', range: [2, 2] as [number, number] },
          { key: 'replacement', range: [2, 4] as [number, number] },
        ],
      },
    ])('prefers a point over a same-start replacement with $name', ({ patches }) => {
      const paragraph = getParagraph(parseWithPatches('abcdef', patches));

      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual(['point']);
      expect(paragraph.children.map((node) => node.type)).toEqual(['text', 'parserPatch', 'text']);
    });

    test.each([
      {
        name: 'longer replacement first',
        patches: [
          { key: 'longer', range: [2, 5] as [number, number] },
          { key: 'shorter', range: [2, 4] as [number, number] },
        ],
      },
      {
        name: 'shorter replacement first',
        patches: [
          { key: 'shorter', range: [2, 4] as [number, number] },
          { key: 'longer', range: [2, 5] as [number, number] },
        ],
      },
    ])('prefers the shorter same-start replacement with $name', ({ patches }) => {
      const paragraph = getParagraph(parseWithPatches('abcdef', patches));
      const applied = collectParserPatches(paragraph);

      expect(applied.map(({ data }) => data.key)).toEqual(['shorter']);
      expect(first(applied)?.data.hProperties.dataPatchText).toBe('cd');
    });

    test.each([
      {
        name: 'a named character reference',
        source: '&amp;x',
        encodedEnd: 5,
        decoded: '&',
      },
      {
        name: 'a numeric character reference',
        source: '&#38;x',
        encodedEnd: 5,
        decoded: '&',
      },
      {
        name: 'a Markdown escape',
        source: String.raw`\*x`,
        encodedEnd: 2,
        decoded: '*',
      },
    ])('maps source ranges through $name', ({ source, encodedEnd, decoded }) => {
      const paragraph = getParagraph(
        parseWithPatches(source, [
          { key: 'decoded', range: [0, encodedEnd] },
          { key: 'after', range: [encodedEnd, source.length] },
        ]),
      );

      expect(paragraph.children.map((node) => node.type)).toEqual(['parserPatch', 'parserPatch']);
      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual([
        'decoded',
        'after',
      ]);
      expect(
        collectParserPatches(paragraph).map(({ data }) => data.hProperties.dataPatchText),
      ).toEqual([decoded, 'x']);
    });

    test('skips a patch consumed by an earlier replacement but keeps its end boundary', () => {
      const paragraph = getParagraph(
        parseWithPatches('hello', [
          { key: 'replacement', range: [1, 4] },
          { key: 'covered', range: [2, 2] },
          { key: 'boundary', range: [4, 4] },
        ]),
      );

      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual([
        'replacement',
        'boundary',
      ]);
    });

    test('skips a replacement inside inline code', () => {
      const paragraph = getParagraph(
        parseWithPatches('`hello`', [{ key: 'blocked', range: [1, 3] }]),
      );

      expect(paragraph.children).toHaveLength(1);
      expect(first(paragraph.children)?.type).toBe('inlineCode');
      expect(collectParserPatches(paragraph)).toEqual([]);
    });

    test('continues with later patches after a blocked node', () => {
      const paragraph = getParagraph(
        parseWithPatches('`hi`there', [
          { key: 'blocked', range: [1, 2] },
          { key: 'after', range: [4, 4] },
        ]),
      );

      expect(first(paragraph.children)?.type).toBe('inlineCode');
      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual(['after']);
      expect(getText(last(paragraph.children)).value).toBe('there');
    });

    test('consumes a nested phrasing boundary exactly once', () => {
      const paragraph = getParagraph(
        parseWithPatches('a**bc**d', [{ key: 'before-strong', range: [1, 1] }]),
      );
      const strong = getStrong(nth(paragraph.children, 2));

      expect(paragraph.children.map((node) => node.type)).toEqual([
        'text',
        'parserPatch',
        'strong',
        'text',
      ]);
      expect(collectParserPatches(paragraph)).toHaveLength(1);
      expect(getText(first(strong.children)).value).toBe('bc');
    });

    test('places a document-start point inside the paragraph before nested phrasing', () => {
      const root = parseWithPatches('**bc**', [{ key: 'document-start', range: [0, 0] }]);
      const paragraph = getParagraph(root);

      expect(root.children.map((node) => node.type)).toEqual(['paragraph']);
      expect(paragraph.children.map((node) => node.type)).toEqual(['parserPatch', 'strong']);
      expect(getParserPatch(first(paragraph.children)).data.key).toBe('document-start');
    });

    test('places a nested phrasing end point after the nested child', () => {
      const root = parseWithPatches('**bc**', [{ key: 'after-strong', range: [6, 6] }]);
      const paragraph = getParagraph(root);
      const strong = getStrong(first(paragraph.children));

      expect(paragraph.children.map((node) => node.type)).toEqual(['strong', 'parserPatch']);
      expect(strong.children.map((node) => node.type)).toEqual(['text']);
      expect(getParserPatch(nth(paragraph.children, 1)).data.key).toBe('after-strong');
    });

    test('applies a replacement wholly inside nested phrasing text', () => {
      const paragraph = getParagraph(
        parseWithPatches('a**bc**d', [{ key: 'inside-strong', range: [3, 4] }]),
      );
      const strong = getStrong(nth(paragraph.children, 1));

      expect(strong.children.map((node) => node.type)).toEqual(['parserPatch', 'text']);
      expect(getParserPatch(first(strong.children)).data.hProperties.dataPatchText).toBe('b');
      expect(getText(nth(strong.children, 1)).value).toBe('c');
    });

    test('skips replacements that cross nested phrasing boundaries', () => {
      const tree = parseWithPatches('a**bc**d', [{ key: 'cross-boundary', range: [1, 5] }]);

      expect(collectParserPatches(tree)).toEqual([]);
      expect(stripPositions(tree)).toEqual(stripPositions(parseMarkdown('a**bc**d', [])));
    });

    test('consumes a link boundary exactly once', () => {
      const paragraph = getParagraph(
        parseWithPatches('a[bc](https://example.com)d', [{ key: 'before-link', range: [1, 1] }]),
      );

      expect(paragraph.children.map((node) => node.type)).toEqual([
        'text',
        'parserPatch',
        'link',
        'text',
      ]);
      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual(['before-link']);
    });

    test('emits positionless patch metadata while retaining text source positions', () => {
      const paragraph = getParagraph(
        parseWithPatches('hello', [{ key: 'replacement', range: [1, 4] }]),
      );
      const prefix = getText(first(paragraph.children));
      const patch = getParserPatch(nth(paragraph.children, 1));
      const suffix = getText(nth(paragraph.children, 2));

      expect(patch).toEqual({
        type: 'parserPatch',
        data: {
          key: 'replacement',
          hName: 'span',
          hProperties: {
            dataParserPatch: '1',
            dataPatchKey: 'replacement',
            dataPatchText: 'ell',
          },
        },
      });
      expect(getOffsetRange(prefix)).toEqual([0, 1]);
      expect(patch.position).toBeUndefined();
      expect(getOffsetRange(suffix)).toEqual([4, 5]);
    });

    test('bridges patches to HAST spans in source order', () => {
      const root = parseHastWithPatches('hello', [{ key: 'replacement', range: [1, 4] }]);
      const paragraph = getHastElement(first(root.children), 'p');
      const prefix = getHastText(first(paragraph.children));
      const patch = getHastElement(nth(paragraph.children, 1), 'span');
      const suffix = getHastText(nth(paragraph.children, 2));

      expect(prefix.value).toBe('h');
      expect(patch.properties).toMatchObject({
        dataParserPatch: '1',
        dataPatchKey: 'replacement',
        dataPatchText: 'ell',
      });
      expect(suffix.value).toBe('o');
    });
  });

  describe('plugin composition', () => {
    test.each([
      {
        name: 'before the math candidate',
        range: [1, 1] as [number, number],
        expectedTypes: ['text', 'parserPatch', 'text', 'inlineMath'],
      },
      {
        name: 'at the math opening',
        range: [2, 2] as [number, number],
        expectedTypes: ['text', 'parserPatch', 'inlineMath'],
      },
      {
        name: 'at end of input',
        range: [4, 4] as [number, number],
        expectedTypes: ['text', 'inlineMath', 'parserPatch'],
      },
    ])('keeps ending-math repair working for a patch $name', ({ range, expectedTypes }) => {
      const root = parseMarkdown('a $x', [
        new PatchesRemarkPlugin({ patches: [{ key: 'cursor', range }] }),
        new SyntaxMathRemarkPlugin({ repairEnding: true }),
      ]);
      const paragraph = getParagraph(root);
      const math = paragraph.children.find((node) => node.type === 'inlineMath');

      expect(paragraph.children.map((node) => node.type)).toEqual(expectedTypes);
      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual(['cursor']);
      expect(math).toMatchObject({ type: 'inlineMath', value: 'x' });
    });

    test('does not repair ending math when a patch splits the candidate body', () => {
      const root = parseMarkdown('a $xy', [
        new PatchesRemarkPlugin({ patches: [{ key: 'cursor', range: [4, 4] }] }),
        new SyntaxMathRemarkPlugin({ repairEnding: true }),
      ]);
      const paragraph = getParagraph(root);

      expect(paragraph.children.some((node) => node.type === 'inlineMath')).toBe(false);
      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual(['cursor']);
    });
  });

  describe('defensive behavior', () => {
    test('handles sparse patch arrays without throwing', () => {
      const patches: IRawPatchItem[] = [{ key: 'valid', range: [0, 0] }];

      patches.length = 2;

      const tree = parseWithPatches('hello', patches);

      expect(collectParserPatches(tree).map(({ data }) => data.key)).toEqual(['valid']);
    });

    test('skips an unsplittable text node and still applies a later patch', () => {
      const tree: MdastRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                value: 'aa',
                position: {
                  start: { line: 1, column: 1, offset: 0 },
                  end: { line: 1, column: 4, offset: 3 },
                },
              },
              {
                type: 'text',
                value: 'bb',
                position: {
                  start: { line: 1, column: 4, offset: 3 },
                  end: { line: 1, column: 6, offset: 5 },
                },
              },
            ],
          },
        ],
      };
      const actual = runRemarkPlugin(
        tree,
        new PatchesRemarkPlugin({
          patches: [
            { key: 'skipped', range: [1, 1] },
            { key: 'applied', range: [4, 4] },
          ],
        }),
      );
      const paragraph = getParagraph(actual);

      expect(paragraph.children.map((node) => node.type)).toEqual([
        'text',
        'text',
        'parserPatch',
        'text',
      ]);
      expect(getText(first(paragraph.children)).value).toBe('aa');
      expect(getParserPatch(nth(paragraph.children, 2)).data.key).toBe('applied');
    });

    test('skips sparse child entries and still applies a patch to a later child', () => {
      const children: Paragraph['children'] = [];

      children.length = 2;
      children[1] = {
        type: 'text',
        value: 'ab',
        position: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 3, offset: 2 },
        },
      };

      const tree: MdastRoot = {
        type: 'root',
        children: [{ type: 'paragraph', children }],
      };
      const actual = runRemarkPlugin(
        tree,
        new PatchesRemarkPlugin({ patches: [{ key: 'point', range: [1, 1] }] }),
      );

      expect(getParagraph(actual).children.map((node) => node.type)).toEqual([
        'text',
        'parserPatch',
        'text',
      ]);
    });

    test('leaves text without source offsets unchanged', () => {
      const tree: MdastRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'hello' }],
          },
        ],
      };
      const original = cloneDeep(tree);

      const actual = runRemarkPlugin(
        tree,
        new PatchesRemarkPlugin({ patches: [{ key: 'point', range: [1, 1] }] }),
      );

      expect(actual).toEqual(original);
      expect(collectParserPatches(actual)).toEqual([]);
    });

    test('applies text patches when the transformer is called without a VFile', () => {
      const tree: MdastRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                value: 'hello',
                position: {
                  start: { line: 1, column: 1, offset: 0 },
                  end: { line: 1, column: 6, offset: 5 },
                },
              },
            ],
          },
        ],
      };
      const transformer = new PatchesRemarkPlugin({
        patches: [{ key: 'point', range: [2, 2] }],
      }).plugin.call(unified());

      expect(transformer).toBeTypeOf('function');
      assert(transformer);
      const transformWithoutFile = transformer as unknown as (root: MdastRoot) => void;

      expect(() => transformWithoutFile(tree)).not.toThrow();
      expect(collectParserPatches(tree).map(({ data }) => data.key)).toEqual(['point']);
    });
  });

  describe('parent gaps', () => {
    test('places a patch between root blocks', () => {
      const root = parseWithPatches('hello\n\n\n### next\n', [{ key: 'gap', range: [6, 6] }]);

      expect(root.children.map((node) => node.type)).toEqual([
        'paragraph',
        'parserPatch',
        'heading',
      ]);
      expect(getParserPatch(nth(root.children, 1)).data.key).toBe('gap');
    });

    test('places a patch in a trailing root gap', () => {
      const root = parseWithPatches('hello\n\n\n', [{ key: 'tail', range: [6, 6] }]);

      expect(root.children.map((node) => node.type)).toEqual(['paragraph', 'parserPatch']);
      expect(getParserPatch(nth(root.children, 1)).data.key).toBe('tail');
    });

    test('consumes a block boundary once inside the preceding paragraph', () => {
      const root = parseWithPatches('hello\n\n\n### next\n', [{ key: 'boundary', range: [5, 5] }]);

      expect(root.children.map((node) => node.type)).toEqual(['paragraph', 'heading']);
      expect(collectParserPatches(root).map(({ data }) => data.key)).toEqual(['boundary']);
      expect(collectParserPatches(getParagraph(root))).toHaveLength(1);
    });

    test('bridges a root-gap patch between HAST block elements', () => {
      const root = parseHastWithPatches('hello\n\n\n### next\n', [{ key: 'gap', range: [6, 6] }]);
      const paragraphIndex = findHastElementIndex(root, 'p');
      const patchIndex = findHastElementIndex(root, 'span');
      const headingIndex = findHastElementIndex(root, 'h3');
      const patch = getHastElement(nth(root.children, patchIndex), 'span');

      expect(paragraphIndex).toBeLessThan(patchIndex);
      expect(patchIndex).toBeLessThan(headingIndex);
      expect(patch.properties).toMatchObject({
        dataParserPatch: '1',
        dataPatchKey: 'gap',
      });
    });
  });

  describe('list gaps', () => {
    const getFirstListParagraph = (root: MdastRoot): Paragraph => {
      const list = getList(first(root.children));
      const item = getListItem(first(list.children));
      const paragraph = first(item.children);

      expect(paragraph?.type).toBe('paragraph');
      assert(paragraph?.type === 'paragraph');

      return paragraph;
    };

    test('assigns an adjacent list tail gap to the final item paragraph', () => {
      const text = '- item\n\n### next\n';
      const offset = text.indexOf('\n\n') + 1;
      const root = parseWithPatches(text, [{ key: 'list-tail', range: [offset, offset] }]);
      const paragraph = getFirstListParagraph(root);

      expect(root.children.map((node) => node.type)).toEqual(['list', 'heading']);
      expect(paragraph.children.map((node) => node.type)).toEqual(['text', 'parserPatch']);
      expect(getParserPatch(nth(paragraph.children, 1)).data.key).toBe('list-tail');
    });

    test('assigns a gap between list items to the preceding item paragraph', () => {
      const text = '- first\n\n- second\n';
      const offset = text.indexOf('\n\n') + 1;
      const root = parseWithPatches(text, [{ key: 'between-items', range: [offset, offset] }]);
      const list = getList(first(root.children));
      const firstItem = getListItem(first(list.children));
      const second = getListItem(nth(list.children, 1));
      const firstParagraph = first(firstItem.children);
      const secondParagraph = first(second.children);

      expect(firstParagraph?.type).toBe('paragraph');
      expect(secondParagraph?.type).toBe('paragraph');
      assert(firstParagraph?.type === 'paragraph');
      assert(secondParagraph?.type === 'paragraph');
      expect(collectParserPatches(firstParagraph).map(({ data }) => data.key)).toEqual([
        'between-items',
      ]);
      expect(collectParserPatches(secondParagraph)).toEqual([]);
    });

    test('assigns a loose list-item paragraph gap to the preceding paragraph', () => {
      const text = '- first\n\n  second\n';
      const offset = text.indexOf('\n\n') + 1;
      const root = parseWithPatches(text, [{ key: 'between-paragraphs', range: [offset, offset] }]);
      const list = getList(first(root.children));
      const item = getListItem(first(list.children));
      const [firstParagraph, secondParagraph] = item.children;

      expect(firstParagraph?.type).toBe('paragraph');
      expect(secondParagraph?.type).toBe('paragraph');
      assert(firstParagraph?.type === 'paragraph');
      assert(secondParagraph?.type === 'paragraph');
      expect(collectParserPatches(firstParagraph).map(({ data }) => data.key)).toEqual([
        'between-paragraphs',
      ]);
      expect(collectParserPatches(secondParagraph)).toEqual([]);
      expect(item.children.map((node) => node.type)).toEqual(['paragraph', 'paragraph']);
    });

    test('assigns an adjacent list-item tail gap to its paragraph', () => {
      const text = '- item\n\n\n### next\n';
      const offset = text.indexOf('\n\n\n') + 1;
      const root = parseWithPatches(text, [{ key: 'item-tail', range: [offset, offset] }]);
      const paragraph = getFirstListParagraph(root);

      expect(collectParserPatches(paragraph).map(({ data }) => data.key)).toEqual(['item-tail']);
    });

    test('keeps a patch after multiple line endings at the root level', () => {
      const text = '- item\n\n\n### next\n';
      const offset = text.indexOf('\n\n\n') + 2;
      const root = parseWithPatches(text, [{ key: 'distant-gap', range: [offset, offset] }]);

      expect(root.children.map((node) => node.type)).toEqual(['list', 'parserPatch', 'heading']);
      expect(getParserPatch(nth(root.children, 1)).data.key).toBe('distant-gap');
    });

    test('supports an adjacent CRLF list gap', () => {
      const text = '- item\r\n\r\n### next\r\n';
      const offset = text.indexOf('\r\n\r\n') + 2;
      const root = parseWithPatches(text, [{ key: 'crlf-gap', range: [offset, offset] }]);

      expect(collectParserPatches(getFirstListParagraph(root)).map(({ data }) => data.key)).toEqual(
        ['crlf-gap'],
      );
    });

    test('assigns a single-line list gap with horizontal whitespace to the final item', () => {
      const text = '- item\n \t\n### next\n';
      const offset = text.indexOf('\n \t\n') + '\n \t'.length;
      const root = parseWithPatches(text, [{ key: 'spaced-gap', range: [offset, offset] }]);

      expect(collectParserPatches(getFirstListParagraph(root)).map(({ data }) => data.key)).toEqual(
        ['spaced-gap'],
      );
    });

    test('falls back to the list item when its final child is not a paragraph', () => {
      const text = '- outer\n  - inner\n\n### next\n';
      const offset = text.indexOf('\n\n') + 1;
      const root = parseWithPatches(text, [{ key: 'nested-list-tail', range: [offset, offset] }]);
      const list = getList(first(root.children));
      const outerItem = getListItem(first(list.children));

      expect(outerItem.children.map((node) => node.type)).toEqual([
        'paragraph',
        'list',
        'parserPatch',
      ]);
      expect(getParserPatch(last(outerItem.children)).data.key).toBe('nested-list-tail');
    });

    test('keeps an ordinary root gap as a root sibling', () => {
      const text = 'hello\n\n### next\n';
      const offset = text.indexOf('\n\n') + 1;
      const root = parseWithPatches(text, [{ key: 'root-gap', range: [offset, offset] }]);

      expect(root.children.map((node) => node.type)).toEqual([
        'paragraph',
        'parserPatch',
        'heading',
      ]);
    });
  });

  describe('syntax gaps', () => {
    test('places a patch inside an empty table cell', () => {
      const text = ['| a |  | c |', '| :--- | :--- | :--- |', '| x |  | z |', ''].join('\n');
      const baseline = parseMarkdown(text, [new SyntaxTableRemarkPlugin()]);
      const emptyCell = findMdastNode(baseline, 'tableCell', (node) => node.children.length === 0);

      expect(emptyCell).toBeDefined();
      assert(emptyCell);
      const [start, end] = getOffsetRange(emptyCell);
      const offset = floor((start + end) / 2);
      const root = parseTableWithPatches(text, [{ key: 'empty-cell', range: [offset, offset] }]);
      const matchingCell = findMdastNode(root, 'tableCell', (node) => {
        const position = node.position;

        return position?.start.offset === start && position.end.offset === end;
      });

      expect(matchingCell).toBeDefined();
      assert(matchingCell);
      expect(collectParserPatches(matchingCell).map(({ data }) => data.key)).toEqual([
        'empty-cell',
      ]);
    });

    test('places a patch before a nested child in a table cell', () => {
      const text = ['| **a** | b |', '| :--- | :--- |', '| c | d |', ''].join('\n');
      const baseline = parseMarkdown(text, [new SyntaxTableRemarkPlugin()]);
      const cell = findMdastNode(baseline, 'tableCell', (node) =>
        node.children.some((child) => child.type === 'strong'),
      );

      expect(cell).toBeDefined();
      assert(cell);
      const strong = cell.children.find((node) => node.type === 'strong');

      expect(strong).toBeDefined();
      assert(strong);
      const [strongStart] = getOffsetRange(strong);
      const root = parseTableWithPatches(text, [
        { key: 'before-strong', range: [strongStart, strongStart] },
      ]);
      const patchedCell = findMdastNode(root, 'tableCell', (node) =>
        node.children.some((child) => child.type === 'parserPatch'),
      );

      expect(patchedCell).toBeDefined();
      assert(patchedCell);
      const patchIndex = patchedCell.children.findIndex((node) => node.type === 'parserPatch');
      const strongIndex = patchedCell.children.findIndex((node) => node.type === 'strong');

      expect(patchIndex).toBeGreaterThanOrEqual(0);
      expect(patchIndex).toBeLessThan(strongIndex);
    });

    test('places a patch in the list marker gap without breaking list structure', () => {
      const text = '- a\n';
      const baseline = parseMarkdown(text, []);
      const item = findMdastNode(baseline, 'listItem');
      const paragraph = findMdastNode(baseline, 'paragraph');

      expect(item).toBeDefined();
      expect(paragraph).toBeDefined();
      assert(item && paragraph);
      const [itemStart] = getOffsetRange(item);
      const [paragraphStart] = getOffsetRange(paragraph);
      const offset = itemStart + 1;

      expect(offset).toBeLessThan(paragraphStart);

      const root = parseWithPatches(text, [{ key: 'marker-gap', range: [offset, offset] }]);
      const patchedItem = findMdastNode(root, 'listItem');

      expect(patchedItem).toBeDefined();
      assert(patchedItem);
      expect(
        patchedItem.children.some(
          (node) => node.type === 'parserPatch' && node.data.key === 'marker-gap',
        ),
      ).toBe(true);
    });
  });
});
