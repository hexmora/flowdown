import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

import { clamp, create, floor, last, min, toArray, values } from 'lodash-es';
import { describe, expect, test, vi } from 'vitest';

import { BlockStateClosure } from '../../index';
import { getLengthOfHast } from '../length';
import { sliceHast } from '../slice';

const root = (children: RootContent[]): Root => ({
  type: 'root',
  children,
});

const text = (value: string): Text => ({
  type: 'text',
  value,
});

const preservedWhitespace = (value: string): Text => ({
  type: 'text',
  value,
  data: {
    flowdownPreservedWhitespace: true,
  },
});

const element = (
  tagName: string,
  children: ElementContent[] = [],
  properties: Element['properties'] = {},
): Element => ({
  type: 'element',
  tagName,
  properties,
  children,
});

const leaf = (tagName: string, sentinel: string) => {
  return element(tagName, [], { 'data-sentinel': sentinel });
};

const splitGraphemes = (value: string) => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

  return (toArray(segmenter.segment(value)) as unknown as Intl.SegmentData[]).map(
    ({ segment }) => segment,
  );
};

// oxlint-disable-next-line unicorn/prefer-set-has -- Fixed lookup tables use arrays by convention.
const TABLE_STRUCTURE_TAG_NAMES = [
  'caption',
  'col',
  'colgroup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
];
// oxlint-disable-next-line unicorn/prefer-set-has -- Fixed lookup tables use arrays by convention.
const TABLE_LAYOUT_TAG_NAMES = ['colgroup', 'table', 'thead', 'tbody', 'tfoot', 'tr'];
// oxlint-disable-next-line unicorn/prefer-set-has -- Fixed lookup tables use arrays by convention.
const INVISIBLE_TAG_NAMES = ['script', 'style', 'template'];

const isLayoutWhitespace = (node: Text) => {
  const data = node.data as Record<string, unknown> | undefined;

  return (
    data?.flowdownPreservedWhitespace !== true &&
    node.value.trim().length === 0 &&
    /[\r\n]/.test(node.value)
  );
};

const hasTableInDirection = (
  children: readonly RootContent[],
  childIndex: number,
  direction: -1 | 1,
) => {
  for (
    let index = childIndex + direction;
    index >= 0 && index < children.length;
    index += direction
  ) {
    const sibling = children[index];

    if (!sibling) {
      continue;
    }

    if (sibling.type === 'element') {
      return TABLE_STRUCTURE_TAG_NAMES.includes(sibling.tagName.toLowerCase());
    }

    if (sibling.type === 'text') {
      if (isLayoutWhitespace(sibling)) {
        continue;
      }

      return false;
    }

    if (sibling.type !== 'comment' && sibling.type !== 'doctype') {
      return false;
    }
  }

  return false;
};

const ignoresLayoutWhitespace = (
  parentTagName: string | undefined,
  children: readonly RootContent[],
  childIndex: number,
) => {
  return (
    (parentTagName !== undefined && TABLE_LAYOUT_TAG_NAMES.includes(parentTagName)) ||
    hasTableInDirection(children, childIndex, -1) ||
    hasTableInDirection(children, childIndex, 1)
  );
};

type VisibleEntry = {
  node: RootContent;
  ignoreFormattingWhitespace: boolean;
};

const collectVisibleUnits = (tree: Root): string[] => {
  const pending: VisibleEntry[] = [];
  const units: string[] = [];

  for (let index = tree.children.length - 1; index >= 0; index -= 1) {
    const node = tree.children[index];

    if (node) {
      pending.push({
        node,
        ignoreFormattingWhitespace: ignoresLayoutWhitespace(undefined, tree.children, index),
      });
    }
  }

  while (pending.length > 0) {
    const entry = pending.pop();

    if (!entry) {
      continue;
    }

    const { node, ignoreFormattingWhitespace } = entry;

    if (node.type === 'text') {
      if (ignoreFormattingWhitespace && isLayoutWhitespace(node)) {
        continue;
      }

      units.push(...splitGraphemes(node.value));
      continue;
    }

    if (node.type !== 'element') {
      continue;
    }

    const tagName = node.tagName.toLowerCase();

    if (INVISIBLE_TAG_NAMES.includes(tagName)) {
      continue;
    }

    if (tagName === 'col') {
      continue;
    }

    if (node.children.length === 0) {
      if (!TABLE_STRUCTURE_TAG_NAMES.includes(tagName)) {
        units.push(`leaf:${tagName}:${String(node.properties['data-sentinel'] ?? '')}`);
      }

      continue;
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      const child = node.children[index];

      if (child) {
        pending.push({
          node: child,
          ignoreFormattingWhitespace: ignoresLayoutWhitespace(tagName, node.children, index),
        });
      }
    }
  }

  return units;
};

const deepFreeze = <T>(value: T): T => {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];

  while (pending.length > 0) {
    const current = pending.pop();

    if (typeof current !== 'object' || current === null || seen.has(current)) {
      continue;
    }

    seen.add(current);
    pending.push(...values(current));
    Object.freeze(current);
  }

  return value;
};

class BlockStateSliceHarness extends BlockStateClosure {
  applySlice(value: Root, start: number, end: number) {
    return this.slice(value, start, end);
  }
}

describe('sliceHast', () => {
  test('treats indices as grapheme offsets', () => {
    expect(typeof Intl.Segmenter).toBe('function');

    const source = root([text('A👨‍👩‍👧‍👦🇨🇳👍🏽e\u0301Z')]);
    const output = sliceHast(source, 1, 5);

    expect(output).toEqual(root([text('👨‍👩‍👧‍👦🇨🇳👍🏽e\u0301')]));
    expect(getLengthOfHast(output as Root)).toBe(4);
  });

  test('uses code points if grapheme segmentation is unavailable', async () => {
    const intl = Intl as unknown as { Segmenter?: typeof Intl.Segmenter };
    const originalSegmenter = intl.Segmenter;

    try {
      intl.Segmenter = undefined;
      vi.resetModules();

      const { sliceHast: sliceWithoutSegmenter } = await import('../slice');
      const output = sliceWithoutSegmenter(root([text('A👨‍👩‍👧‍👦B')]), 1, 2);

      expect(output).toEqual(root([text('👨')]));
    } finally {
      intl.Segmenter = originalSegmenter;
      vi.resetModules();
    }
  });

  test('normalizes the start and rejects empty or invalid windows', () => {
    const source = root([text('abcdef')]);

    expect(sliceHast(source, -20, 2)).toEqual(root([text('ab')]));
    expect(sliceHast(source, 1.9, 4.8)).toEqual(root([text('bcd')]));
    expect(sliceHast(source, 2, 2)).toBeNull();
    expect(sliceHast(source, 4, 2)).toBeNull();
    expect(sliceHast(source, Number.NaN, 2)).toBeNull();
    expect(sliceHast(source, 0, Number.NaN)).toBeNull();
    expect(sliceHast(source, Infinity, Infinity)).toBeNull();
  });

  test('returns null when the root is empty, malformed, or outside the range', () => {
    expect(sliceHast(root([]), 0, 1)).toBeNull();
    expect(sliceHast(root([text('abc')]), 20, 30)).toBeNull();
    expect(sliceHast(text('abc') as unknown as Root, 0, 1)).toBeNull();
  });

  test('clips an overlong or infinite end to the available suffix', () => {
    const source = root([text('abc')]);

    expect(sliceHast(source, 1, 999)).toEqual(root([text('bc')]));
    expect(sliceHast(source, 1, Infinity)).toEqual(root([text('bc')]));
  });

  test('keeps an intersecting empty element as one indivisible unit', () => {
    const source = root([text('A'), leaf('img', 'portrait'), text('B')]);

    expect(sliceHast(source, 1, 2)).toEqual(root([leaf('img', 'portrait')]));
    expect(getLengthOfHast(sliceHast(source, 1, 2) as Root)).toBe(1);
  });

  test('does not count hidden subtrees or empty table cells', () => {
    const source = root([
      { type: 'doctype' },
      { type: 'comment', value: 'comment' },
      text('A'),
      element('SCRIPT', [text('secret')]),
      element('style', [text('concealed')]),
      element('template', [leaf('img', 'concealed-leaf')]),
      element('td'),
      element('TH'),
      text('B'),
      leaf('span', 'empty-span'),
    ]);

    expect(getLengthOfHast(source)).toBe(3);
    expect(sliceHast(source, 1, 2)).toEqual(root([text('B')]));
    expect(sliceHast(source, 2, 3)).toEqual(root([leaf('span', 'empty-span')]));
  });

  test('removes parent branches that have no selected content', () => {
    const source = root([
      element('div', [element('span', [text('KEEP')])]),
      element('div', [element('span', [text('DROP')])]),
    ]);

    expect(sliceHast(source, 0, 4)).toEqual(
      root([element('div', [element('span', [text('KEEP')])])]),
    );
  });

  test('preserves wrapper structure across a mixed range', () => {
    const source = root([
      text('A'),
      leaf('img', 'cover'),
      element('p', [text('BC'), element('strong', [text('D🙂')]), leaf('br', 'break'), text('EF')]),
      element('script', [text('ignored')]),
      leaf('span', 'empty'),
      text('G'),
    ]);

    const output = sliceHast(source, 2, 9);

    expect(output).toEqual(
      root([
        element('p', [
          text('BC'),
          element('strong', [text('D🙂')]),
          leaf('br', 'break'),
          text('EF'),
        ]),
      ]),
    );
    expect(getLengthOfHast(output as Root)).toBe(7);
  });

  test('filters generated table whitespace without discarding nested newlines', () => {
    const source = root([
      text('\n  '),
      element('table', [
        text('\n  '),
        element('tbody', [
          text('\r\n'),
          element('tr', [
            text('\n'),
            element('td', [text('A')]),
            element('td'),
            element('td', [element('pre', [text('\n')])]),
          ]),
        ]),
      ]),
      text('\n'),
      text('tail'),
    ]);

    expect(getLengthOfHast(source)).toBe(6);
    expect(sliceHast(source, 0, 2)).toEqual(
      root([
        element('table', [
          element('tbody', [
            element('tr', [
              element('td', [text('A')]),
              element('td'),
              element('td', [element('pre', [preservedWhitespace('\n')])]),
            ]),
          ]),
        ]),
      ]),
    );
  });

  test('retains table topology while selecting a single cell', () => {
    const source = root([
      element('table', [
        element('colgroup', [element('col'), element('col'), element('col')]),
        element('thead', [
          element('tr', [
            element('th', [text('H1')]),
            element('th', [text('H2')]),
            element('th', [text('H3')]),
          ]),
        ]),
        element('tbody', [
          element('tr', [
            element('td', [text('A')]),
            element('td', [text('B')], { className: ['selected-column'] }),
            element('td', [text('C')]),
          ]),
          element('tr', [
            element('td', [text('D')]),
            element('td', [text('E')]),
            element('td', [text('F')]),
          ]),
        ]),
      ]),
    ]);

    const output = sliceHast(source, 7, 8);

    expect(output).toEqual(
      root([
        element('table', [
          element('colgroup', [element('col'), element('col'), element('col')]),
          element('thead', [element('tr', [element('th'), element('th'), element('th')])]),
          element('tbody', [
            element('tr', [
              element('td'),
              element('td', [text('B')], { className: ['selected-column'] }),
              element('td'),
            ]),
            element('tr', [element('td'), element('td'), element('td')]),
          ]),
        ]),
      ]),
    );
    expect(getLengthOfHast(output as Root)).toBe(1);
  });

  test('keeps sliced table-adjacent newlines in the visible index space', () => {
    const source = root([
      element('table', [element('tbody', [element('tr', [element('td', [text('A')])])])]),
      text('\nX'),
    ]);

    expect(getLengthOfHast(source)).toBe(3);

    const output = sliceHast(source, 0, 2) as Root;
    const trailingText = last(output.children) as Text;

    expect(trailingText.value).toBe('\n');
    expect(getLengthOfHast(output)).toBe(2);

    const newlineOnly = sliceHast(output, 1, 2) as Root;

    expect(newlineOnly.children).toEqual([expect.objectContaining({ type: 'text', value: '\n' })]);
    expect(getLengthOfHast(newlineOnly)).toBe(1);
  });

  test('keeps visible newlines when zero-width siblings disappear', () => {
    const table = () => {
      return element('table', [element('tbody', [element('tr', [element('td', [text('A')])])])]);
    };
    const barrier = () => {
      return element('span', [element('script', [text('hidden')])]);
    };
    const afterTable = root([table(), barrier(), text('\nX')]);
    const beforeTable = root([text('X\n'), barrier(), table()]);

    const afterOutput = sliceHast(afterTable, 0, 2) as Root;
    const beforeOutput = sliceHast(beforeTable, 1, 3) as Root;

    expect(collectVisibleUnits(afterOutput)).toEqual(['A', '\n']);
    expect(collectVisibleUnits(beforeOutput)).toEqual(['\n', 'A']);
    expect(getLengthOfHast(afterOutput)).toBe(2);
    expect(getLengthOfHast(beforeOutput)).toBe(2);
  });

  test('keeps visible newlines when a nested table becomes adjacent', () => {
    const source = root([
      element('table', [
        element('tbody', [
          element('tr', [
            element('td', [
              element('table', [element('tbody', [element('tr', [element('td', [text('A')])])])]),
              element('span', [element('template', [text('hidden')])]),
              text('\nX'),
            ]),
          ]),
        ]),
      ]),
    ]);

    const output = sliceHast(source, 0, 2) as Root;

    expect(collectVisibleUnits(output)).toEqual(['A', '\n']);
    expect(getLengthOfHast(output)).toBe(2);
  });

  test('does not hide a distant line break when the root also contains a table', () => {
    const source = root([
      element('p', [text('A')]),
      text('\n'),
      element('p', [text('B')]),
      element('table', [element('tbody', [element('tr', [element('td', [text('C')])])])]),
    ]);

    expect(getLengthOfHast(source)).toBe(4);
    expect(sliceHast(source, 0, 3)).toEqual(
      root([element('p', [text('A')]), preservedWhitespace('\n'), element('p', [text('B')])]),
    );
  });

  test('skips an empty table scaffold before visible content', () => {
    const source = root([
      element('table', [
        element('colgroup', [text('\n'), element('col'), text('\n')]),
        element('tbody', [element('tr', [element('td')])]),
      ]),
      text('A'),
    ]);

    expect(getLengthOfHast(source)).toBe(1);
    expect(sliceHast(source, 0, 1)).toEqual(root([text('A')]));
  });

  test('preserves every visible window across nested and adjacent tables', () => {
    const source = root([
      element('table', [
        element('tbody', [
          element('tr', [
            element('td', [text('A')]),
            element('td'),
            element('td', [
              element('table', [element('tbody', [element('tr', [element('td', [text('B')])])])]),
            ]),
          ]),
        ]),
      ]),
      text('\nX'),
      element('table', [element('tbody', [element('tr', [element('td', [text('C')])])])]),
    ]);
    const units = collectVisibleUnits(source);

    for (let start = 0; start < units.length; start += 1) {
      for (let end = start + 1; end <= units.length; end += 1) {
        const output = sliceHast(source, start, end) as Root;

        expect(getLengthOfHast(output)).toBe(end - start);
        expect(collectVisibleUnits(output)).toEqual(units.slice(start, end));
      }
    }
  });

  test('does not mutate even a deeply frozen input', () => {
    const source = deepFreeze(
      root([
        element('article', [element('p', [text('alpha'), leaf('br', 'line'), text('omega')])]),
      ]),
    );

    expect(() => sliceHast(source, 2, 8)).not.toThrow();

    const output = sliceHast(source, 2, 8) as Root;
    const sourceArticle = source.children[0];
    const outputArticle = output.children[0];

    expect(output).not.toBe(source);
    expect(outputArticle).not.toBe(sourceArticle);
  });

  test('retains metadata while cloning the selected path', () => {
    const sourceText: Text = {
      type: 'text',
      value: 'abcdef',
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 7, offset: 6 },
      },
    };
    const wrapper = element('p', [sourceText], {
      className: ['source'],
      dataMarker: 'wrapper',
    });
    wrapper.position = {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 7, offset: 6 },
    };
    const source: Root = {
      type: 'root',
      children: [wrapper],
      data: { sentinel: 'root' },
      position: wrapper.position,
    };
    const output = sliceHast(source, 1, 4) as Root;
    const outputWrapper = output.children[0] as Element;
    const outputText = outputWrapper.children[0] as Text;

    expect(output.data).toEqual(source.data);
    expect(output.position).toEqual(source.position);
    expect(outputWrapper.properties).toEqual(wrapper.properties);
    expect(outputWrapper.position).toEqual(wrapper.position);
    expect(outputText.position).toEqual(sourceText.position);
    expect(outputText.value).toBe('bcd');
    expect(output).not.toBe(source);
    expect(output.children).not.toBe(source.children);
    expect(outputWrapper).not.toBe(wrapper);
    expect(outputWrapper.children).not.toBe(wrapper.children);
  });

  test('produces contiguous partitions, including null empty partitions', () => {
    const source = root([
      element('strong', [text('ab')]),
      text('cdef'),
      element('em', [text('gh')]),
    ]);
    const boundaries = [0, 1, 5, 8];
    const partitions = boundaries.slice(1).map((end, index) => {
      return sliceHast(source, boundaries[index] ?? 0, end);
    });

    expect(partitions.flatMap((part) => collectVisibleUnits(part as Root))).toEqual(
      collectVisibleUnits(source),
    );
    expect([sliceHast(source, 0, 0), sliceHast(source, 0, 0), sliceHast(source, 0, 2)]).toEqual([
      null,
      null,
      root([element('strong', [text('ab')])]),
    ]);
  });

  test('matches the requested length for representative non-empty windows', () => {
    const source = root([
      element('p', [text('abcd'), leaf('br', 'one'), text('ef')]),
      element('aside', [text('ghij')]),
    ]);

    for (const [start, end] of [
      [0, 1],
      [0, 5],
      [1, 2],
      [2, 8],
      [8, 11],
    ]) {
      const output = sliceHast(source, start, end);

      expect(output).not.toBeNull();
      expect(getLengthOfHast(output as Root)).toBe(end - start);
    }
  });

  test('handles very deep wrapper trees without recursive traversal', () => {
    let child: ElementContent = leaf('img', 'deep');

    for (let depth = 0; depth < 10_000; depth += 1) {
      child = element('div', [child]);
    }

    const output = sliceHast(root([child]), 0, 1);

    expect(output).not.toBeNull();
    expect(getLengthOfHast(output as Root)).toBe(1);
  });
});

describe('BlockStateClosure slicing', () => {
  const closure = create(BlockStateSliceHarness.prototype) as BlockStateSliceHarness;

  test('delegates visible ranges to sliceHast', () => {
    const source = root([element('p', [text('hello')])]);

    expect(closure.applySlice(source, 1, 4)).toEqual(sliceHast(source, 1, 4));
  });

  test('creates a fresh metadata-preserving empty root for an empty range', () => {
    const source: Root = {
      type: 'root',
      children: [text('hello')],
      data: { sentinel: 'source' },
    };
    const first = closure.applySlice(source, 2, 2);
    const second = closure.applySlice(source, 2, 2);

    expect(first).toEqual({
      type: 'root',
      children: [],
      data: { sentinel: 'source' },
    });
    expect(second).toEqual(first);
    expect(first).not.toBe(second);
    expect(first.children).not.toBe(second.children);
  });
});

const createInlineFixture = () => {
  return root([
    element('p', [
      text('intro:'),
      element('strong', [text('bold'), element('em', [text('界🙂')])]),
      text('/'),
      leaf('img', 'inline-image'),
      element('a', [text('link-tail')]),
    ]),
    element('template', [text('hidden')]),
    text('done'),
  ]);
};

const createBlockFixture = () => {
  return root([
    element('section', [
      element('h2', [text('heading')]),
      element('div', [
        element('p', [text('alpha'), leaf('br', 'block-break'), text('beta')]),
        element('ul', [
          element('li', [text('first')]),
          element('li', [element('strong', [text('second🙂')])]),
        ]),
      ]),
    ]),
    element('style', [text('not-visible')]),
    leaf('hr', 'section-end'),
  ]);
};

const createLongFixture = () => {
  const children: RootContent[] = [];

  for (let index = 0; index < 80; index += 1) {
    children.push(
      element('p', [
        text(`row-${index}:`),
        element('strong', [text(`值${index}🙂`)]),
        leaf(index % 2 === 0 ? 'br' : 'img', `repeat-${index}`),
        element('span', [text('|')]),
      ]),
    );
  }

  return root(children);
};

type SliceRange = {
  start: number;
  end: number;
};

const getSampleRanges = (total: number, units: readonly string[]): SliceRange[] => {
  const ranges = new Map<string, SliceRange>();
  const add = (start: number, end: number) => {
    const boundedStart = clamp(start, 0, total);
    const boundedEnd = clamp(end, boundedStart, total);

    if (boundedEnd > boundedStart) {
      ranges.set(`${boundedStart}:${boundedEnd}`, {
        start: boundedStart,
        end: boundedEnd,
      });
    }
  };

  for (const width of [20, 60, 120]) {
    add(0, width);
    add(total - width, total);
  }

  add(0, total);
  add(floor(total / 3) - 20, floor(total / 3) + 30);
  add(floor(total / 2) - 20, floor(total / 2) + 30);
  add(floor((total * 2) / 3) - 20, floor((total * 2) / 3) + 30);

  const leafIndex = units.findIndex((unit) => unit.startsWith('leaf:'));

  if (leafIndex >= 0) {
    add(leafIndex - 5, leafIndex + 6);
  }

  for (const index of [0, 1, 10, 50]) {
    add(index, index + 1);
  }

  return [...ranges.values()];
};

describe.each([
  { name: 'nested inline document', tree: deepFreeze(createInlineFixture()) },
  { name: 'multi-block document', tree: deepFreeze(createBlockFixture()) },
  { name: 'long repeated document', tree: deepFreeze(createLongFixture()) },
])('sliceHast fixture coverage: $name', ({ tree }) => {
  test('preserves the exact visible stream across broad windows', () => {
    const units = collectVisibleUnits(tree);
    const total = getLengthOfHast(tree);

    expect(total).toBe(units.length);

    for (const { start, end } of getSampleRanges(total, units)) {
      const output = sliceHast(tree, start, end);

      expect(output).not.toBeNull();
      expect(getLengthOfHast(output as Root)).toBe(end - start);
      expect(collectVisibleUnits(output as Root)).toEqual(units.slice(start, end));
    }
  });

  test('isolates every visible unit in the first two hundred positions', () => {
    const units = collectVisibleUnits(tree);
    const limit = min([units.length, 200]) ?? 0;

    for (let index = 0; index < limit; index += 1) {
      const output = sliceHast(tree, index, index + 1);

      expect(output).not.toBeNull();
      expect(collectVisibleUnits(output as Root)).toEqual([units[index]]);
    }
  });
});
