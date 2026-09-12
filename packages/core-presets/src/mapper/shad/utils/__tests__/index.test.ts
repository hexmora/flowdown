import type { Element, ElementContent, Properties, Root, RootContent, Text } from 'hast';

import { getLengthOfHast } from '@fluxdown/utils';

import { createShadRoot, SHAD_DATA_ATTR, SHAD_HOST_VALUE, SHAD_TAG_NAME } from '../index';

const text = (value: string): Text => ({ type: 'text', value });

const element = (
  tagName: string,
  children: ElementContent[] = [],
  properties: Properties = {},
): Element => ({ type: 'element', tagName, properties, children });

const root = (children: RootContent[]): Root => ({ type: 'root', children });

const getText = (node: Root | RootContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  return 'children' in node ? node.children.map(getText).join('') : '';
};

const getHost = (node: Root | RootContent): Element | undefined => {
  if (node.type === 'element' && node.properties[SHAD_DATA_ATTR] === SHAD_HOST_VALUE) {
    return node;
  }

  if ('children' in node) {
    for (const child of node.children) {
      const host = getHost(child);

      if (host) {
        return host;
      }
    }
  }

  return undefined;
};

const getParts = (output: Root) => {
  const host = getHost(output);

  expect(host?.tagName).toBe(SHAD_TAG_NAME);
  expect(host?.children).toHaveLength(2);

  return host?.children.map(getText);
};

describe('createShadRoot', () => {
  test.each([0, -1, 0.5, Number.NaN])('returns the source when length is %s', (length) => {
    const source = root([element('p', [text('abc')])]);

    expect(createShadRoot(source, { length, activeLength: 1 })).toBe(source);
  });

  test.each([
    { activeLength: 0, expected: ['def', ''] },
    { activeLength: 1, expected: ['de', 'f'] },
    { activeLength: 2, expected: ['d', 'ef'] },
    { activeLength: 3, expected: ['', 'def'] },
    { activeLength: 8, expected: ['', 'def'] },
    { activeLength: -1, expected: ['def', ''] },
    { activeLength: Number.NaN, expected: ['def', ''] },
  ])('keeps a stable host with activeLength $activeLength', ({ activeLength, expected }) => {
    const source = root([element('p', [text('abcdef')])]);
    const output = createShadRoot(source, { length: 3, activeLength });

    expect(getParts(output)).toEqual(expected);
    expect(output.children[0]).toMatchObject({
      children: [text('abc'), { properties: { [SHAD_DATA_ATTR]: SHAD_HOST_VALUE } }],
    });
    expect(getText(output)).toBe(getText(source));
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test('splits emoji and combining characters as complete graphemes', () => {
    const source = root([text('A👨‍👩‍👧‍👦e\u0301🇨🇳')]);
    const output = createShadRoot(source, { length: 3, activeLength: 2 });

    expect(output.children[0]).toEqual(text('A'));
    expect(getParts(output)).toEqual(['👨‍👩‍👧‍👦', 'e\u0301🇨🇳']);
    expect(getLengthOfHast(output)).toBe(4);
  });

  test('extends across inline formatting and retains the source and unaffected references', () => {
    const untouched = element('p', [text('first')]);
    const strong = element('strong', [text('bc')], { className: ['bold'] });
    const source = root([untouched, element('p', [text('a'), strong, text('def')])]);
    const snapshot = structuredClone(source);
    const output = createShadRoot(source, { length: 5, activeLength: 3 });
    const host = getHost(output);

    expect(source).toEqual(snapshot);
    expect(output).not.toBe(source);
    expect(output.children[0]).toBe(untouched);
    expect(getParts(output)).toEqual(['bc', 'def']);
    expect(host?.children[0]).toMatchObject({ children: [strong] });
    expect((host?.children[0] as Element | undefined)?.children[0]).toBe(strong);
    expect(getText(output)).toBe(getText(source));
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test('keeps the host inside the deepest parent that can provide the configured tail', () => {
    const prefix = text('prefix ');
    const source = root([element('p', [prefix, element('em', [text('abcdef')])])]);
    const output = createShadRoot(source, { length: 3, activeLength: 2 });
    const paragraph = output.children[0] as Element;
    const emphasis = paragraph.children[1] as Element;

    expect(paragraph.children[0]).toBe(prefix);
    expect(emphasis.children[1]).toBe(getHost(output));
    expect(getParts(output)).toEqual(['d', 'ef']);
  });

  test.each(['a', 'annotation', 'code', 'math', 'pre', 'svg'])(
    'does not move an effect before a trailing %s subtree',
    (tagName) => {
      const source = root([text('safe'), element(tagName, [text('opaque')])]);

      expect(createShadRoot(source, { length: 3, activeLength: 2 })).toBe(source);
    },
  );

  test.each(['a', 'annotation', 'code', 'math', 'pre', 'svg'])(
    'keeps the effect before a trailing empty %s element',
    (tagName) => {
      const trailing = element(tagName);
      const source = root([element('p', [text('abc'), trailing])]);
      const output = createShadRoot(source, { length: 2, activeLength: 1 });

      expect(getParts(output)).toEqual(['b', 'c']);
      expect((output.children[0] as Element).children[2]).toBe(trailing);
      expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
    },
  );

  test('skips a forbidden subtree containing only formatting whitespace', () => {
    const trailing = element('code', [text('\n')]);
    const source = root([element('p', [text('abc'), trailing])]);
    const output = createShadRoot(source, { length: 2, activeLength: 1 });

    expect(getParts(output)).toEqual(['b', 'c']);
    expect((output.children[0] as Element).children[2]).toBe(trailing);
  });

  test.each(['tex', 'x-label'])(
    'includes an ordinary %s element in the inline suffix',
    (tagName) => {
      const source = root([element('p', [text('ab'), element(tagName, [text('cd')])])]);
      const output = createShadRoot(source, { length: 4, activeLength: 2 });

      expect(getParts(output)).toEqual(['ab', 'cd']);
      expect(getHost(output)?.children[1]).toMatchObject({
        children: [{ tagName, children: [text('cd')] }],
      });
      expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
    },
  );

  test.each(['inline-math', 'block-math'])('does not split a %s placeholder', (dataType) => {
    const source = root([text('safe'), element('span', [text('x+y')], { dataType })]);

    expect(createShadRoot(source, { length: 3, activeLength: 2 })).toBe(source);
  });

  test.each([
    [text('safe'), element('span', [], { dataParserPatch: '1' }), text('tail')],
    [text('safe'), element('span', [], { dataParserPatch: '1' })],
    [element('span', [text('replacement')], { dataParserPatch: '1' })],
  ])('does not animate a patch or its adjacent text', (...children) => {
    const source = root(children);

    expect(createShadRoot(source, { length: 3, activeLength: 2 })).toBe(source);
  });

  test.each(['a', 'code'])('does not extend through a preceding %s subtree', (tagName) => {
    const opaque = element(tagName, [text('opaque')]);
    const source = root([element('p', [text('prefix'), opaque, text('tail')])]);
    const output = createShadRoot(source, { length: 20, activeLength: 20 });

    expect((output.children[0] as Element).children[1]).toBe(opaque);
    expect(getParts(output)).toEqual(['', 'tail']);
    expect(getText(output)).toBe(getText(source));
  });

  test.each(['p', 'h2', 'div', 'li'])('does not cross %s block siblings', (tagName) => {
    const preceding = element('p', [text('earlier')]);
    const source = root([preceding, element(tagName, [element('em', [text('T')])])]);
    const output = createShadRoot(source, { length: 20, activeLength: 20 });

    expect(output.children[0]).toBe(preceding);
    expect(getParts(output)).toEqual(['', 'T']);
    expect(output.children[1]).toMatchObject({ tagName });
  });

  test.each([
    [element('p', [text('abc')]), text('d')],
    [text('abc'), element('p', [text('d')])],
  ])('stops at a direct block and inline sibling boundary', (...children) => {
    const source = root(children);
    const output = createShadRoot(source, { length: 4, activeLength: 4 });

    expect(getParts(output)).toEqual(['', 'd']);
    expect(getText(output)).toBe('abcd');
  });

  test('extends past a block inside an inline wrapper when its outer siblings remain inline', () => {
    const source = root([text('abc'), element('x-box', [element('p', [text('d')])])]);
    const output = createShadRoot(source, { length: 4, activeLength: 1 });

    expect(output.children[0]).toBe(getHost(output));
    expect(getParts(output)).toEqual(['abc', 'd']);
    expect(getHost(output)?.children[1]).toMatchObject({
      children: [{ tagName: 'x-box', children: [{ tagName: 'p', children: [text('d')] }] }],
    });
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test('includes a preceding inline wrapper even when its first child is a block', () => {
    const source = root([text('a'), element('x-box', [element('p', [text('b')])]), text('c')]);
    const output = createShadRoot(source, { length: 4, activeLength: 2 });

    expect(output.children[0]).toBe(getHost(output));
    expect(getParts(output)).toEqual(['a', 'bc']);
    expect(getHost(output)?.children[1]).toMatchObject({
      children: [
        { tagName: 'x-box', children: [{ tagName: 'p', children: [text('b')] }] },
        text('c'),
      ],
    });
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test.each(['\n', '\r\n'])('limits the suffix to the last line after %j', (newline) => {
    const source = root([element('p', [text(`before${newline}tail`)])]);
    const output = createShadRoot(source, { length: 20, activeLength: 2 });

    expect(getParts(output)).toEqual(['ta', 'il']);
    expect(getText(output)).toBe(getText(source));
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test.each([
    { value: 'ab\rcd', expected: ['ab\r', 'cd'] },
    { value: 'abc\r', expected: ['ab', 'c\r'] },
  ])('keeps a standalone carriage return in the suffix for $value', ({ value, expected }) => {
    const source = root([element('p', [text(value)])]);
    const output = createShadRoot(source, { length: 20, activeLength: 2 });

    expect(getParts(output)).toEqual(expected);
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test.each([
    [element('p', [text('abc'), text('')])],
    [element('p', [text('abc'), element('em', [text('')])])],
    [element('table', [element('tr', [element('td', [text('abc')]), element('td', [text('')])])])],
  ])('does not skip an empty trailing text to shade earlier content', (...children) => {
    const source = root(children);

    expect(createShadRoot(source, { length: 3, activeLength: 2 })).toBe(source);
  });

  test.each([
    [text('ends\n')],
    [text('ends'), element('br')],
    [text('ends'), element('em', [element('br')])],
  ])('returns the source when the last line is empty', (...children) => {
    const source = root([element('p', children)]);

    expect(createShadRoot(source, { length: 3, activeLength: 2 })).toBe(source);
  });

  test('stops at br and visible leaf siblings', () => {
    for (const tagName of ['br', 'img']) {
      const source = root([element('p', [text('before'), element(tagName), text('tail')])]);
      const output = createShadRoot(source, { length: 20, activeLength: 20 });

      expect(getParts(output)).toEqual(['', 'tail']);
      expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
    }
  });

  test('ignores trailing image and formatting nodes while retaining them', () => {
    const image = element('img', [], { src: 'image.png' });
    const formatting = text('\n');
    const source = root([element('p', [text('tail'), image]), formatting]);
    const output = createShadRoot(source, { length: 3, activeLength: 2 });

    expect(getParts(output)).toEqual(['a', 'il']);
    expect((output.children[0] as Element).children[2]).toBe(image);
    expect(output.children[1]).toBe(formatting);
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test('keeps hidden subtrees and comments between affected text nodes', () => {
    const hidden = element('script', [text('hidden')]);
    const comment: RootContent = { type: 'comment', value: 'comment' };
    const source = root([element('p', [text('AB'), hidden, comment, text('CD')])]);
    const output = createShadRoot(source, { length: 4, activeLength: 2 });
    const host = getHost(output);
    const leading = host?.children[0] as Element;

    expect(leading.children[1]).toBe(hidden);
    expect(leading.children[2]).toBe(comment);
    expect(getText(output)).toBe(getText(source));
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test('retains descendants after the last text when the effect spans inline siblings', () => {
    const image = element('img');
    const source = root([element('p', [text('AB'), element('em', [text('CD'), image])])]);
    const output = createShadRoot(source, { length: 3, activeLength: 2 });
    const paragraph = output.children[0] as Element;

    expect(getParts(output)).toEqual(['B', 'CD']);
    expect(paragraph.children[2]).toMatchObject({ tagName: 'em', children: [image] });
    expect((paragraph.children[2] as Element).children[0]).toBe(image);
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });

  test('keeps table structure and empty cells while constraining the effect to its cell', () => {
    const firstCell = element('td', [text('AB')]);
    const emptyCell = element('td');
    const source = root([
      element('table', [
        text('\n'),
        element('tbody', [
          text('\n'),
          element('tr', [firstCell, element('td', [text('CD')]), emptyCell]),
          text('\n'),
        ]),
        text('\n'),
      ]),
      text('\n'),
    ]);
    const output = createShadRoot(source, { length: 20, activeLength: 20 });
    const table = output.children[0] as Element;
    const body = table.children[1] as Element;
    const row = body.children[1] as Element;

    expect(table.tagName).toBe('table');
    expect(body.tagName).toBe('tbody');
    expect(row.tagName).toBe('tr');
    expect(row.children).toHaveLength(3);
    expect(row.children[0]).toBe(firstCell);
    expect(row.children[2]).toBe(emptyCell);
    expect(row.children[1]).toMatchObject({ tagName: 'td', children: [getHost(output)] });
    expect(getParts(output)).toEqual(['', 'CD']);
    expect(getLengthOfHast(output)).toBe(getLengthOfHast(source));
  });
});
