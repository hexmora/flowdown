import { BatchScheduler, type IReactiveState, MutableState } from '@flowdown/reactive';
import { cloneDeep } from 'lodash-es';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import { type IBlockSection, type IRawPatchItem, TextChunkerStateClosure } from '..';
import { type ChunkedPatch, chunkPatchesByTexts } from '../patches';
import { chunkTextOfMarkdown } from '../utils';

type ChunkCase = {
  name: string;
  text: string;
  expected: string[];
};

const chunks = (name: string, ...expected: string[]): ChunkCase => ({
  name,
  text: expected.join(''),
  expected,
});

const expectChunks = (text: string, expected: string[]) => {
  const result = chunkTextOfMarkdown(text);

  expect(result).toEqual(expected);
  expect(result.join('')).toBe(text);

  if (text.trim() !== '') {
    expect(result.every((chunk) => chunk.trim() !== '')).toBe(true);
  }
};

const getObserverCount = (state: IReactiveState<unknown>) => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

const TABLE = `| a | b |
| - | - |
| 1 | 2 |
`;

const MARKDOWN_CASES: ChunkCase[] = [
  chunks('returns no chunks for empty input'),
  chunks('keeps a whitespace-only document intact', '\n\n'),
  chunks('attaches leading blank lines to the first block', '\n\npara\n'),
  chunks('keeps a soft break in its paragraph', 'line 1\nline 2\n'),
  chunks('attaches separating blank lines to the preceding paragraph', 'para 1\n\n', 'para 2\n'),
  chunks('splits ordinary root blocks', '# Title\n\n', 'Para with **bold**.\n\n', 'Next line.\n'),
  chunks('splits an ATX heading from a following list', '# Title\n', '- a\n- b\n'),
  chunks('keeps a Setext heading intact', 'Title\n---\n', 'after\n'),
  chunks('keeps an equals Setext heading intact', 'Title\n===\n'),
  chunks('does not mistake a pipe in a Setext heading for a table', 'a | b\n---\n', 'after\n'),
  chunks('recognizes a standalone dash thematic break', '---\n'),
  chunks('recognizes a standalone thematic break', '***\n'),
  chunks('recognizes a spaced thematic break', '- - -\n'),
  chunks('follows the Setext interpretation of an ambiguous dash line', 'before\n---\n', 'after\n'),
  chunks('does not treat three dollar signs as display math', '$$$\n', '# Heading\n'),
  chunks('keeps lazy continuation text in an unordered list', '- a\n- b\nafter\n'),
  chunks('keeps lazy continuation text in an ordered list', '1. a\n2. b\nafter\n'),
  chunks('keeps a non-one ordered list and its lazy continuation together', '2. a\n3. b\nafter\n'),
  chunks('keeps lazy continuation text in a task list', '- [x] done\nafter\n'),
  chunks('splits a paragraph after a blank line from its list', '- a\n- b\n\n', 'after\n'),
  chunks('splits adjacent lists with different markers', '- a\n- b\n', '1. c\n2. d\n'),
  chunks(
    'keeps table-like lines inside their list item',
    '- item\n  | a | b |\n  | - | - |\n  | 1 | 2 |\n  after\n',
  ),
  chunks('keeps a blockquote atomic', '> quote\n> tail\n'),
  chunks('splits content after a blockquote', '> para 1\n>\n> para 2\n\n', 'after\n'),
  chunks(
    'keeps fenced code inside a list item',
    "- item\n\n  ```js\n  console.log('a');\n  ```\n\n  tail\n",
  ),
  chunks(
    'keeps fenced code inside a blockquote',
    "> quote\n>\n> ```js\n> console.log('a');\n> ```\n>\n> tail\n",
  ),
  chunks('keeps an unclosed code fence through EOF', '```js\nconsole.log(1);\n'),
  chunks('supports tilde code fences', '~~~txt\nhi\n~~~\n'),
  chunks(
    'does not close a long fence with a shorter fence',
    "````md\n```js\nconsole.log('inner');\n```\n````\n",
    'after\n',
  ),
  chunks('splits consecutive code fences', '```txt\na\n```\n', '```txt\nb\n```\n'),
  chunks('splits text after a code fence without a blank line', '```txt\na\n```\n', 'after\n'),
  chunks(
    'splits a heading after a code fence without a blank line',
    '```txt\na\n```\n',
    '# Next\n',
  ),
  chunks('splits a list after a code fence without a blank line', '```txt\na\n```\n', '- item\n'),
  chunks(
    'splits a blockquote after a code fence without a blank line',
    '```txt\na\n```\n',
    '> quote\n',
  ),
  chunks('keeps indented code intact', '    code\n    line\n'),
  chunks('keeps a compact HTML block intact', '<div>\n<span>hi</span>\n</div>\n'),
  chunks('splits content after an HTML block', '<div>\n<span>hi</span>\n</div>\n\n', 'after\n'),
  chunks('keeps blank lines inside a pre block', '<pre>\nline 1\n\nline 2\n</pre>\n', 'after\n'),
  chunks(
    'keeps blank lines inside a script block',
    '<script>\nconst value = 1;\n\nconsole.log(value);\n</script>\n',
    'after\n',
  ),
  chunks('keeps blank lines inside a style block', '<style>\na|b\n\nc|d\n</style>\n', 'after\n'),
  chunks('splits content after an HTML comment', '<!-- a|b -->\n', 'after\n'),
  chunks(
    'follows marked boundaries for a generic HTML block with blank lines',
    '<div class="a">\nline 1\n\n',
    'line 2\n',
    '</div>\nafter\n',
  ),
  chunks(
    'follows marked boundaries for a custom HTML tag with blank lines',
    '<my-custom-tag>\nline 1\n\n',
    'line 2\n</my-custom-tag>\nafter\n',
  ),
  chunks(
    'follows marked boundaries for nested custom HTML tags',
    '<my-custom-tag>\n<my-custom-tag>\ninner\n</my-custom-tag>\n\n',
    'outer\n</my-custom-tag>\nafter\n',
  ),
  chunks('keeps unknown block syntax under marked paragraph semantics', ':::tip\nhi\n:::\n'),
  chunks('preserves CRLF line endings', '# Title\r\n\r\n', 'paragraph\r\n'),
];

const TABLE_CASES: ChunkCase[] = [
  chunks('keeps a GFM table intact', TABLE),
  chunks(
    'preserves table alignment and escaped pipes',
    '| a \\| b | c |\n| :-- | --: |\n| 1   | 2   |\n',
  ),
  chunks('recognizes a table after a paragraph without a blank line', 'before\n', TABLE),
  chunks('stops a table before plain text without a blank line', TABLE, 'after\n'),
  chunks('stops a table before an ATX heading', TABLE, '# Next | Pipe\n'),
  chunks('stops a table before a list', TABLE, '- item | pipe\n'),
  chunks('stops a table before a non-one ordered list', TABLE, '2. item | pipe\n'),
  chunks('stops a table before a blockquote', TABLE, '> | q | w |\n> | - | - |\n'),
  chunks('stops a table before a fenced code block', TABLE, '```txt\na | b\n```\n'),
  chunks('stops a table before an indented code block', TABLE, '    a | b\n'),
  chunks('stops a table before a thematic break', TABLE, '---\n'),
  chunks('attaches a separating blank line to the table', `${TABLE}\n`, 'after\n'),
  chunks('stops a table before an HTML block', TABLE, '<pre>| x | y |</pre>\n\n', 'after\n'),
  chunks('supports tables without outer pipes', 'a | b\n--- | ---\n1 | 2\n', 'after\n'),
  chunks('allows body rows with fewer cells', '| a | b |\n| - | - |\n| 1 |\n', 'after\n'),
  chunks(
    'does not treat mismatched header and delimiter cells as a table',
    '| a | b |\n| - | - | - |\nafter\n',
  ),
  chunks(
    'preserves CRLF in a table and its following block',
    '| a | b |\r\n| - | - |\r\n| 1 | 2 |\r\n',
    'after\r\n',
  ),
];

const DISPLAY_MATH_CASES: ChunkCase[] = [
  chunks('keeps a dollar math block intact', '$$\nE = mc^2\n$$\n\n', 'Next para.\n'),
  chunks(
    'starts dollar math after a paragraph without a blank line',
    'before\n',
    '$$\na\n$$\n',
    'after\n',
  ),
  chunks('keeps unclosed dollar math through EOF', '$$\nE = mc^2\n'),
  chunks('supports a dollar closing delimiter at EOF', '$$\nE = mc^2\n$$'),
  chunks(
    'shields Setext and thematic-break-like lines in dollar math',
    '$$\na\n=\nb\n\nc\n---\nd\n$$\n\n',
    'after\n',
  ),
  chunks(
    'shields root Markdown syntax in dollar math',
    `$$
# not a heading

- not a list
1. not an ordered list

> not a quote

***

\`\`\`js
not a fence
\`\`\`

<div>not HTML</div>

[ref]: https://example.test

| a | b |
| - | - |
| 1 | 2 |
$$

`,
    'after\n',
  ),
  chunks(
    'does not close dollar math on escaped delimiters',
    '$$\nline 1\n\\$\\$\nline 2\n$$\n\n',
    'after\n',
  ),
  chunks(
    'allows up to three spaces before a dollar closing delimiter',
    '$$\na\n   $$\n',
    'after\n',
  ),
  chunks(
    'does not close dollar math on a four-space-indented delimiter',
    '$$\na\n    $$\nmore\n$$\n',
    'after\n',
  ),
  chunks(
    'accepts trailing spaces on a dollar closing delimiter',
    '$$\nE = mc^2\n$$   \n',
    'after\n',
  ),
  chunks('splits text immediately after dollar math', '$$\nE = mc^2\n$$\n', 'after\n'),
  chunks('recognizes dollar math indented by two spaces', '  $$\n  a + b\n  $$\n\n', 'Next\n'),
  chunks(
    'leaves four-space-indented dollar lines as code',
    '    $$\n    a + b\n    $$\n\n',
    'Next\n',
  ),
  chunks('leaves tab-indented dollar lines to marked', '\t$$\n\ta + b\n\t$$\n\n', 'Next\n'),
  chunks(
    'keeps multiple dollar math blocks independent',
    'Before\n\n',
    '$$\na\n$$\n\n',
    'Middle\n\n',
    '$$\nb\n---\nc\n$$\n\n',
    'After\n',
  ),
  chunks('supports a loose dollar opening', 'before\n\n', '$$a\n---\nb\n$$\n\n', 'after\n'),
  chunks('supports a same-line loose dollar span', '$$a||||aa$$\n'),
  chunks('supports a same-line loose dollar span at EOF', '$$a||||aa$$'),
  chunks('returns a same-line dollar span to marked', '$$a$$\nafter\n'),
  chunks('returns a loose span with trailing text to marked', '$$a||||aa$$xxxxx\n', '# Title\n'),
  chunks('keeps unclosed loose dollar math through EOF', '$$a\n---\nb\n'),
  chunks('does not treat inline dollars as display math', 'Text $$a$$ text\n'),
  chunks('does not tokenize dollars inside fenced code', '```md\n$$\na+b\n$$\n```\n\n', 'after\n'),
  chunks(
    'keeps dollar math inside its list container',
    '- item\n\n  $$\n  a\n  ---\n  b\n  $$\n\n',
    'end\n',
  ),
  chunks(
    'keeps dollar math inside its blockquote container',
    '> quote\n>\n> $$\n> a\n> ---\n> b\n> $$\n>\n> end\n',
  ),
  chunks('keeps a Pandoc math block intact', '\\[\na+b\n\\]\n'),
  chunks(
    'starts Pandoc math after a paragraph without a blank line',
    'before\n',
    '\\[\na\n\\]\n',
    'after\n',
  ),
  chunks(
    'shields Markdown-looking lines in Pandoc math',
    '\\[\na\n---\nb\n=\nc\n***\nd\n\\]\n',
    'after\n',
  ),
  chunks('keeps unclosed Pandoc math through EOF', '\\[\na+b\n'),
  chunks(
    'allows up to three spaces before a Pandoc closing delimiter',
    '\\[\na\n   \\]\n',
    'after\n',
  ),
  chunks(
    'does not close Pandoc math on a four-space-indented delimiter',
    '\\[\na\n    \\]\n\\]\n',
    'after\n',
  ),
  chunks(
    'leaves four-space-indented Pandoc delimiters as code',
    '    \\[\n    a\n    \\]\n\n',
    'after\n',
  ),
  chunks('preserves CRLF in dollar math', '$$\r\na\r\n$$\r\n', 'after\r\n'),
  chunks('preserves CRLF in Pandoc math', '\\[\r\na\r\n\\]\r\n', 'after\r\n'),
];

const DOCUMENT_SCOPED_CASES: ChunkCase[] = [
  chunks(
    'falls back to one chunk for a footnote reference',
    'Here is a footnote[^1].\n\nNext paragraph.\n',
  ),
  chunks(
    'falls back to one chunk for a footnote definition',
    'Before.\n\n[^note]: footnote definition\n',
  ),
  chunks(
    'falls back to one chunk for a footnote reference and definition',
    'Here is a footnote[^1].\n\n[^1]: footnote definition\n',
  ),
  chunks(
    'falls back to one chunk for a reference link definition',
    '# Title\n\nRead [the reference][ref].\n\n[ref]: https://example.test "Example"\n',
  ),
  chunks(
    'ignores footnote-like syntax inside fenced code',
    '```md\n[^1]: not a footnote\n```\n\n',
    'after\n',
  ),
  chunks(
    'ignores footnote-like syntax inside inline code',
    'Before `[^1]: not a footnote` after.\n\n',
    'Next paragraph.\n',
  ),
  chunks(
    'ignores footnote-like syntax inside indented code',
    '    [^1]: not a footnote\n\n',
    'after\n',
  ),
  chunks(
    'ignores reference definitions inside fenced code',
    '```md\n[ref]: https://example.test "Example"\n```\n',
    'after\n',
  ),
  chunks(
    'ignores footnote-like syntax inside raw HTML',
    '<pre>\n[^1]: not a footnote\n</pre>\n',
    'after\n',
  ),
  chunks(
    'ignores reference definitions shielded by display math',
    '$$\n[ref]: https://example.test\n$$\n\n',
    'after\n',
  ),
  chunks(
    'ignores footnote-like syntax shielded by display math',
    '$$\n[^1]: not a footnote\n$$\n\n',
    'after\n',
  ),
  chunks('ignores escaped footnote references', 'Escaped \\[^1].\n\n', 'Next paragraph.\n'),
  chunks(
    'ignores invalid footnote labels containing spaces',
    'Literal [^not a footnote].\n\n',
    'Next paragraph.\n',
  ),
  chunks(
    'ignores footnote-like syntax inside an autolink',
    '<https://example.test/[^1]>\n\n',
    'Next paragraph.\n',
  ),
  chunks(
    'ignores footnote-like syntax inside a link label',
    '[label [^1]](https://example.test)\n\n',
    'Next paragraph.\n',
  ),
  chunks(
    'finds a reference definition after repairing a table boundary',
    `${TABLE}[ref]: https://example.test/a|b

Use [the reference][ref].
`,
  ),
];

describe('chunkTextOfMarkdown', () => {
  test.each(MARKDOWN_CASES)('$name', ({ text, expected }) => {
    expectChunks(text, expected);
  });

  describe('GFM tables', () => {
    test.each(TABLE_CASES)('$name', ({ text, expected }) => {
      expectChunks(text, expected);
    });
  });

  describe('display math', () => {
    test.each(DISPLAY_MATH_CASES)('$name', ({ text, expected }) => {
      expectChunks(text, expected);
    });
  });

  describe('document-scoped syntax', () => {
    test.each(DOCUMENT_SCOPED_CASES)('$name', ({ text, expected }) => {
      expectChunks(text, expected);
    });
  });
});

describe('chunkPatchesByTexts', () => {
  test('returns block-aligned local patch ranges', () => {
    expect(
      chunkPatchesByTexts(
        [
          { key: 'first', range: 1 },
          { key: 'second', range: [7, 9] },
        ],
        ['first\n', 'second'],
      ),
    ).toEqual([[{ key: 'first', range: [1, 1] }], [{ key: 'second', range: [1, 3] }]]);
  });

  test('assigns boundary and EOF insertion points to the following and final blocks', () => {
    expect(
      chunkPatchesByTexts(
        [
          { key: 'boundary', range: 3 },
          { key: 'eof', range: 6 },
        ],
        ['abc', 'def'],
      ),
    ).toEqual([
      [],
      [
        { key: 'boundary', range: [0, 0] },
        { key: 'eof', range: [3, 3] },
      ],
    ]);
  });

  test('discards invalid and cross-block ranges', () => {
    expect(
      chunkPatchesByTexts(
        [
          { key: 'negative', range: [-1, 1] },
          { key: 'reversed', range: [2, 1] },
          { key: 'overflow', range: [0, 7] },
          { key: 'not-a-number', range: Number.NaN },
          { key: 'fractional', range: 1.5 },
          { key: 'cross-block', range: [2, 4] },
        ],
        ['abc', 'def'],
      ),
    ).toEqual([[], []]);
  });

  test('sorts patches and removes conflicts while preserving equal points', () => {
    expect(
      chunkPatchesByTexts(
        [
          { key: 'right', range: [3, 5] },
          { key: 'left', range: [0, 2] },
          { key: 'overlap', range: [1, 4] },
          { key: 'point-a', range: 2 },
          { key: 'point-b', range: 2 },
        ],
        ['abcdef'],
      ),
    ).toEqual([
      [
        { key: 'left', range: [0, 2] },
        { key: 'point-a', range: [2, 2] },
        { key: 'point-b', range: [2, 2] },
        { key: 'right', range: [3, 5] },
      ],
    ]);
  });

  test('resolves conflicts between insertion points and replacements', () => {
    expect(
      chunkPatchesByTexts(
        [
          { key: 'replacement', range: [1, 4] },
          { key: 'inside', range: 2 },
        ],
        ['abcdef'],
      ),
    ).toEqual([[{ key: 'replacement', range: [1, 4] }]]);
    expect(
      chunkPatchesByTexts(
        [
          { key: 'replacement', range: [2, 4] },
          { key: 'point', range: 2 },
        ],
        ['abcdef'],
      ),
    ).toEqual([[{ key: 'point', range: [2, 2] }]]);
  });

  test('uses UTF-16 offsets without mutating the input', () => {
    const patches: IRawPatchItem[] = [{ key: 'line-ending', range: [2, 4] }];
    const original = cloneDeep(patches);

    expect(chunkPatchesByTexts(patches, ['🙂', '\r\nx'])).toEqual([
      [],
      [{ key: 'line-ending', range: [0, 2] }],
    ]);
    expect(patches).toEqual(original);
  });

  test('preserves extended patch fields and their types', () => {
    type ExtendedPatch = IRawPatchItem & {
      order: string;
      payload: number;
    };

    const patches: ExtendedPatch[] = [{ key: 'extended', range: 1, order: 'public', payload: 42 }];
    const result = chunkPatchesByTexts(patches, ['text']);

    expectTypeOf(result).toEqualTypeOf<ChunkedPatch<ExtendedPatch>[][]>();
    expect(result).toEqual([[{ key: 'extended', range: [1, 1], order: 'public', payload: 42 }]]);
  });

  test('keeps its output aligned with empty blocks and documents', () => {
    expect(chunkPatchesByTexts([], ['', 'value'])).toEqual([[], []]);
    expect(chunkPatchesByTexts([{ key: 'ignored', range: 0 }], [])).toEqual([]);
  });
});

describe('TextChunkerStateClosure', () => {
  test('exposes reactive sections and follows text and patch changes', () => {
    const text = MutableState.of('# Initial\nparagraph\n');
    const patches = MutableState.of<IRawPatchItem[]>([{ key: 'paragraph', range: 10 }]);
    const closure = new TextChunkerStateClosure({ text, patches });
    const next = vi.fn();

    expectTypeOf(closure.value).toEqualTypeOf<IReactiveState<IBlockSection[]>>();

    closure.value.subscribe(next);

    expect(next.mock.calls).toEqual([
      [
        [
          { text: '# Initial\n', patches: [] },
          { text: 'paragraph\n', patches: [{ key: 'paragraph', range: [0, 0] }] },
        ],
      ],
    ]);

    next.mockClear();
    text.next('# Updated\nparagraph\n');

    expect(closure.value.value).toEqual([
      { text: '# Updated\n', patches: [] },
      { text: 'paragraph\n', patches: [{ key: 'paragraph', range: [0, 0] }] },
    ]);
    expect(next).toHaveBeenCalledOnce();

    next.mockClear();
    patches.next([{ key: 'paragraph', range: [11, 14] }]);

    expect(closure.value.value).toEqual([
      { text: '# Updated\n', patches: [] },
      { text: 'paragraph\n', patches: [{ key: 'paragraph', range: [1, 4] }] },
    ]);
    expect(next).toHaveBeenCalledOnce();

    next.mockClear();
    text.next('');

    expect(closure.value.value).toEqual([]);
    expect(next.mock.calls).toEqual([[[]]]);
  });

  test('sets up lazily with the latest text and only subscribes once', () => {
    const text = MutableState.of('# Initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const textSubscribe = vi.spyOn(text, 'subscribe');
    const patchSubscribe = vi.spyOn(patches, 'subscribe');
    const closure = new TextChunkerStateClosure({ text, patches });

    expect(textSubscribe).not.toHaveBeenCalled();
    expect(patchSubscribe).not.toHaveBeenCalled();

    text.next('# Latest\n');

    expect(closure.value.value).toEqual([{ text: '# Latest\n', patches: [] }]);
    expect(closure.value.value).toEqual([{ text: '# Latest\n', patches: [] }]);
    expect(textSubscribe).toHaveBeenCalledOnce();
    expect(patchSubscribe).toHaveBeenCalledOnce();
  });

  test('publishes only the final chunks from a batch', () => {
    const text = MutableState.of('initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const closure = new TextChunkerStateClosure({ text, patches });
    const next = vi.fn();

    closure.value.subscribe(next);
    next.mockClear();

    BatchScheduler.batch(() => {
      text.next('# Intermediate\n');
      text.next('# Final\nparagraph\n');
      patches.next([{ key: 'paragraph', range: 8 }]);

      expect(next).not.toHaveBeenCalled();
    });

    expect(next.mock.calls).toEqual([
      [
        [
          { text: '# Final\n', patches: [] },
          { text: 'paragraph\n', patches: [{ key: 'paragraph', range: [0, 0] }] },
        ],
      ],
    ]);
  });

  test('closes its output and subscriptions without destroying inputs', () => {
    const text = MutableState.of('initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const closure = new TextChunkerStateClosure({ text, patches });
    const outputSubscription = closure.value.subscribe(() => undefined);

    expect(getObserverCount(text)).toBeGreaterThan(0);
    expect(getObserverCount(patches)).toBeGreaterThan(0);

    closure.destroy();

    expect(outputSubscription.closed).toBe(true);
    expect(text.closed).toBe(false);
    expect(patches.closed).toBe(false);
    expect(getObserverCount(text)).toBe(0);
    expect(getObserverCount(patches)).toBe(0);
    expect(() => closure.destroy()).not.toThrow();
  });

  test('does not subscribe when destroyed before setup', () => {
    const text = MutableState.of('initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const textSubscribe = vi.spyOn(text, 'subscribe');
    const patchSubscribe = vi.spyOn(patches, 'subscribe');
    const closure = new TextChunkerStateClosure({ text, patches });

    closure.destroy();

    expect(textSubscribe).not.toHaveBeenCalled();
    expect(patchSubscribe).not.toHaveBeenCalled();
    expect(() => closure.value).toThrow('Cannot set up a destroyed state closure.');
  });

  test('completes after both inputs complete', () => {
    const text = MutableState.of('initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const closure = new TextChunkerStateClosure({ text, patches });
    const subscription = closure.value.subscribe(() => undefined);

    text.complete();

    expect(closure.value.closed).toBe(false);

    patches.complete();

    expect(closure.value.closed).toBe(true);
    expect(subscription.closed).toBe(true);
    expect(() => closure.destroy()).not.toThrow();
  });

  test('reads the last value when text completed before setup', () => {
    const text = MutableState.of('complete\n');
    const patches = MutableState.of<IRawPatchItem[]>([{ key: 'end', range: 9 }]);

    text.complete();
    patches.complete();

    const closure = new TextChunkerStateClosure({ text, patches });

    expect(closure.value.value).toEqual([
      { text: 'complete\n', patches: [{ key: 'end', range: [9, 9] }] },
    ]);
    expect(closure.value.closed).toBe(true);
  });

  test('forwards errors from text', () => {
    const text = MutableState.of('initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const closure = new TextChunkerStateClosure({ text, patches });
    const error = vi.fn();
    const subscription = closure.value.subscribe({ error });
    const reason = new Error('failed');

    text.error(reason);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(reason);
    expect(subscription.closed).toBe(true);
    expect(patches.closed).toBe(false);
    expect(getObserverCount(patches)).toBe(0);
    expect(() => closure.destroy()).not.toThrow();
  });

  test('forwards errors from patches', () => {
    const text = MutableState.of('initial\n');
    const patches = MutableState.of<IRawPatchItem[]>([]);
    const closure = new TextChunkerStateClosure({ text, patches });
    const error = vi.fn();
    const subscription = closure.value.subscribe({ error });
    const reason = new Error('failed');

    patches.error(reason);

    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(reason);
    expect(subscription.closed).toBe(true);
    expect(text.closed).toBe(false);
    expect(getObserverCount(text)).toBe(1);
    expect(() => closure.destroy()).not.toThrow();
    expect(getObserverCount(text)).toBe(0);
  });
});
