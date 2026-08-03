import type { Root as HastRoot, RootContent as HastRootContent } from 'hast';
import type { Root as MdastRoot } from 'mdast';
import type { Math as BlockMath, InlineMath } from 'mdast-util-math';

import { first, now } from 'lodash-es';
import { toMarkdown, type Options as ToMarkdownOptions } from 'mdast-util-to-markdown';
import remarkParse from 'remark-parse';
import { type Data, unified } from 'unified';
import { describe, expect, test } from 'vitest';

import {
  SyntaxMathRemarkPlugin,
  type SyntaxMathRemarkPluginConfig,
  SyntaxTableRemarkPlugin,
} from '../index';
import {
  collectTextValues,
  getAstProcessorByPlugins,
  markdownToHast,
  parseMarkdown,
  runRemarkPlugin,
  walkMdast,
} from './utils';

type MathNode = InlineMath | BlockMath;

type MathPlaceholder = {
  dataType: 'inline-math' | 'block-math';
  text: string;
};

type MathPlaceholderCase = {
  name: string;
  source: string;
  config: SyntaxMathRemarkPluginConfig | undefined;
  expected: MathPlaceholder[];
};

type RemarkExtensionData = Data & {
  micromarkExtensions?: unknown[];

  fromMarkdownExtensions?: unknown[];

  toMarkdownExtensions?: NonNullable<ToMarkdownOptions['extensions']>;
};

const createPlugin = (config?: SyntaxMathRemarkPluginConfig): SyntaxMathRemarkPlugin => {
  return config ? new SyntaxMathRemarkPlugin(config) : new SyntaxMathRemarkPlugin();
};

const parseMath = (text: string, config?: SyntaxMathRemarkPluginConfig): MdastRoot => {
  return parseMarkdown(text, [createPlugin(config)]);
};

const collectMathNodes = (root: MdastRoot): MathNode[] => {
  const nodes: MathNode[] = [];

  walkMdast(root, (node) => {
    if (node.type === 'inlineMath' || node.type === 'math') {
      nodes.push(node as MathNode);
    }
  });

  return nodes;
};

const collectVisibleText = (root: MdastRoot): string => {
  return collectTextValues(root).join('');
};

const collectHastText = (node: HastRoot | HastRootContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  if ('children' in node) {
    return node.children.map((child) => collectHastText(child)).join('');
  }

  return '';
};

const collectMathPlaceholders = (root: HastRoot | HastRootContent): MathPlaceholder[] => {
  const placeholders: MathPlaceholder[] = [];

  const visit = (node: HastRoot | HastRootContent): void => {
    if (node.type === 'element') {
      const dataType = node.properties?.dataType;

      if (node.tagName === 'span' && (dataType === 'inline-math' || dataType === 'block-math')) {
        placeholders.push({
          dataType,
          text: collectHastText(node),
        });
        return;
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };

  visit(root);

  return placeholders;
};

const parseMathPlaceholders = (
  text: string,
  config?: SyntaxMathRemarkPluginConfig,
): MathPlaceholder[] => {
  return collectMathPlaceholders(
    markdownToHast({
      text,
      remarks: [createPlugin(config)],
    }),
  );
};

describe('SyntaxMathRemarkPlugin', () => {
  describe('dollar syntax', () => {
    test.each([
      {
        name: 'parses basic inline math',
        source: 'prefix $1+1=2$ suffix',
        expected: [{ type: 'inlineMath', value: '1+1=2' }],
      },
      {
        name: 'parses multiple inline expressions in order',
        source: 'a $1$ b $2$ c',
        expected: [
          { type: 'inlineMath', value: '1' },
          { type: 'inlineMath', value: '2' },
        ],
      },
      {
        name: 'parses adjacent inline expressions independently',
        source: 'prefix$123123123$$46456456$suffix',
        expected: [
          { type: 'inlineMath', value: '123123123' },
          { type: 'inlineMath', value: '46456456' },
        ],
      },
      {
        name: 'treats a closed single-line double-dollar expression as inline',
        source: '$$d$$',
        expected: [{ type: 'inlineMath', value: 'd' }],
      },
      {
        name: 'treats an isolated closed single-line double-dollar expression as inline',
        source: ['first', '', '$$W = Fd \\cos\\theta$$', '', 'last'].join('\n'),
        expected: [{ type: 'inlineMath', value: 'W = Fd \\cos\\theta' }],
      },
      {
        name: 'parses a multiline double-dollar fence as block math',
        source: ['$$', '1+1=2', '$$'].join('\n'),
        expected: [{ type: 'math', value: '1+1=2' }],
      },
      {
        name: 'normalizes symmetric padding around a fraction',
        source: String.raw`law: $ \frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C} $`,
        expected: [
          {
            type: 'inlineMath',
            value: String.raw`\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C}`,
          },
        ],
      },
      {
        name: 'normalizes symmetric padding around a simple expression',
        source: String.raw`law: $ a^2 = b^2 + c^2 - 2bc\cos A $`,
        expected: [
          {
            type: 'inlineMath',
            value: String.raw`a^2 = b^2 + c^2 - 2bc\cos A`,
          },
        ],
      },
      {
        name: 'normalizes symmetric padding around an environment',
        source: String.raw`law: $ \begin{cases} sin(\pi - x) = sin(x) \\ cos(\pi - x) = -cos(x) \end{cases} $`,
        expected: [
          {
            type: 'inlineMath',
            value: String.raw`\begin{cases} sin(\pi - x) = sin(x) \\ cos(\pi - x) = -cos(x) \end{cases}`,
          },
        ],
      },
      {
        name: 'normalizes symmetric line-ending padding',
        source: ['prefix $', 'x', '$ suffix'].join('\n'),
        expected: [{ type: 'inlineMath', value: 'x' }],
      },
      {
        name: 'preserves line endings inside inline math',
        source: ['prefix $a', 'b$ suffix'].join('\n'),
        expected: [{ type: 'inlineMath', value: 'a\nb' }],
      },
      {
        name: 'allows a literal dollar inside a double-dollar expression',
        source: 'Include just one: $$ $ $$.',
        expected: [{ type: 'inlineMath', value: '$' }],
      },
      {
        name: 'preserves an internal tab',
        source: 'prefix $a\tb$ suffix',
        expected: [{ type: 'inlineMath', value: 'a\tb' }],
      },
      {
        name: 'allows a digit after a double-dollar closer',
        source: 'prefix $$x$$1 suffix',
        expected: [{ type: 'inlineMath', value: 'x' }],
      },
      {
        name: 'retains syntactically invalid TeX when delimiters are valid',
        source: String.raw`error: $rac{1}{2}(2}/cdot 1|cdot 1$`,
        expected: [
          {
            type: 'inlineMath',
            value: String.raw`rac{1}{2}(2}/cdot 1|cdot 1`,
          },
        ],
      },
    ])('$name', ({ source, expected }) => {
      expect(
        collectMathNodes(parseMath(source)).map(({ type, value }) => ({
          type,
          value,
        })),
      ).toEqual(expected);
    });

    test('does not attach display metadata to single-line double-dollar math', () => {
      const [node] = collectMathNodes(parseMath('prefix $$1+1=2$$ suffix'));

      expect(node).toMatchObject({ type: 'inlineMath', value: '1+1=2' });
      expect(
        (node?.data as { pandocMath?: { mode?: 'inline' | 'display' } } | undefined)?.pandocMath,
      ).toBeUndefined();
    });

    test.each([
      {
        name: 'an unclosed delimiter',
        source: 'prefix $1+1=2 suffix',
        visibleText: 'prefix $1+1=2 suffix',
      },
      {
        name: 'whitespace after an opening delimiter',
        source: String.raw`formula: $ W = Fd \cos\theta$`,
        visibleText: String.raw`formula: $ W = Fd \cos\theta$`,
      },
      {
        name: 'a tab after an opening delimiter',
        source: 'formula: $\tW=Fd$ suffix',
        visibleText: 'formula: $\tW=Fd$ suffix',
      },
      {
        name: 'a line ending after an opening delimiter',
        source: ['formula: $', 'W=Fd$ suffix'].join('\n'),
        visibleText: ['formula: $', 'W=Fd$ suffix'].join('\n'),
      },
      {
        name: 'whitespace before a closing delimiter',
        source: String.raw`formula: $W = Fd \cos\theta $`,
        visibleText: String.raw`formula: $W = Fd \cos\theta $`,
      },
      {
        name: 'a tab before a closing delimiter',
        source: 'formula: $W=Fd\t$ suffix',
        visibleText: 'formula: $W=Fd\t$ suffix',
      },
      {
        name: 'a closing delimiter followed by a digit',
        source: String.raw`formula: $W = Fd \cos\theta$1`,
        visibleText: String.raw`formula: $W = Fd \cos\theta$1`,
      },
      {
        name: 'an escaped opening delimiter',
        source: String.raw`formula: \$W = Fd \cos\theta$`,
        visibleText: String.raw`formula: $W = Fd \cos\theta$`,
      },
      {
        name: 'an escaped closing candidate',
        source: String.raw`formula: $x\$$`,
        visibleText: String.raw`formula: $x$$`,
      },
      {
        name: 'a double-dollar opener with one closing dollar',
        source: '$$12345$',
        visibleText: '$$12345$',
      },
      {
        name: 'a greedy double-dollar opener with a single-dollar closer',
        source: 'Not math: $$x$.',
        visibleText: 'Not math: $$x$.',
      },
      {
        name: 'a single-dollar opener with a double-dollar closer',
        source: 'Not math: $x$$.',
        visibleText: 'Not math: $x$$.',
      },
      {
        name: 'a triple-dollar opener',
        source: '$$$123$$$',
        visibleText: '$$$123$$$',
      },
      {
        name: 'currency and narrative text',
        source:
          'I have $100 of money, and you have $200 of money, also double $$ is support$$ to ignore',
        visibleText:
          'I have $100 of money, and you have $200 of money, also double $$ is support$$ to ignore',
      },
      {
        name: 'plain text enclosed by double dollars',
        source: 'also double $$ is support$$ to ignore',
        visibleText: 'also double $$ is support$$ to ignore',
      },
      {
        name: 'multiple symmetric spaces that remain invalid after one padding layer',
        source: 'formula: $  x  $',
        visibleText: 'formula: $  x  $',
      },
    ])('keeps $name as text', ({ source, visibleText }) => {
      const tree = parseMath(source);

      expect(collectMathNodes(tree)).toEqual([]);
      expect(collectVisibleText(tree)).toBe(visibleText);
    });

    test.each([
      ['inline code', 'prefix `$1+1=2$` suffix'],
      ['fenced code', ['```txt', '$1+1=2$', '```'].join('\n')],
    ])('does not parse math inside %s', (_name, source) => {
      expect(collectMathNodes(parseMath(source))).toEqual([]);
    });

    test('parses a valid expression after an escaped leading dollar', () => {
      const tree = parseMath('Escapes work: \\$$x$.');

      expect(collectMathNodes(tree).map(({ value }) => value)).toEqual(['x']);
      expect(collectVisibleText(tree)).toContain('$');
    });

    test('preserves an escaped trailing dollar after a valid expression', () => {
      const tree = parseMath('Escapes work: $x$\\$.');

      expect(collectMathNodes(tree).map(({ value }) => value)).toEqual(['x']);
      expect(collectVisibleText(tree)).toContain('$');
    });

    test('handles long ambiguous dollar runs without pathological backtracking', () => {
      const source = `$a${'$$a'.repeat(24)}`;
      const startedAt = now();
      const tree = parseMath(source);

      expect(tree.type).toBe('root');
      expect(now() - startedAt).toBeLessThan(250);
    });
  });

  describe('pandoc syntax', () => {
    test.each([
      {
        name: 'parses an inline delimiter',
        source: String.raw`prefix \(1+1=2\) suffix`,
        expectedValue: '1+1=2',
        expectedMode: 'inline',
      },
      {
        name: 'parses a display delimiter',
        source: String.raw`prefix \[1+1=2\] suffix`,
        expectedValue: '1+1=2',
        expectedMode: 'display',
      },
      {
        name: 'preserves whitespace inside inline delimiters',
        source: String.raw`prefix \( 1 + 1 = 2 \) suffix`,
        expectedValue: ' 1 + 1 = 2 ',
        expectedMode: 'inline',
      },
      {
        name: 'preserves soft line endings inside inline delimiters',
        source: ['prefix \\(a', 'b\\) suffix'].join('\n'),
        expectedValue: 'a\nb',
        expectedMode: 'inline',
      },
      {
        name: 'preserves display line endings',
        source: String.raw`\[
a
b
\]`,
        expectedValue: '\na\nb\n',
        expectedMode: 'display',
      },
      {
        name: 'preserves an aligned environment and TeX line breaks',
        source: String.raw`\[
\begin{aligned}
f(x) &= x^2 + 1 \\
f'(x) &= 2x
\end{aligned}
\]`,
        expectedValue: [
          '',
          String.raw`\begin{aligned}`,
          String.raw`f(x) &= x^2 + 1 \\`,
          String.raw`f'(x) &= 2x`,
          String.raw`\end{aligned}`,
          '',
        ].join('\n'),
        expectedMode: 'display',
      },
      {
        name: 'preserves a cases environment',
        source: String.raw`\[
f(x)=\begin{cases}
x^2 & x\ge 0 \\
-x & x<0
\end{cases}
\]`,
        expectedValue: [
          '',
          String.raw`f(x)=\begin{cases}`,
          String.raw`x^2 & x\ge 0 \\`,
          String.raw`-x & x<0`,
          String.raw`\end{cases}`,
          '',
        ].join('\n'),
        expectedMode: 'display',
      },
      {
        name: 'does not confuse TeX command backslashes with a closer',
        source: String.raw`prefix \(\frac{1}{2}\) suffix`,
        expectedValue: String.raw`\frac{1}{2}`,
        expectedMode: 'inline',
      },
      {
        name: 'preserves complex display TeX commands',
        source: String.raw`\[
\sum_{i=1}^{n} i = \frac{n(n+1)}{2},\quad \int_0^1 x^2\,dx=\frac{1}{3}
\]`,
        expectedValue: [
          '',
          String.raw`\sum_{i=1}^{n} i = \frac{n(n+1)}{2},\quad \int_0^1 x^2\,dx=\frac{1}{3}`,
          '',
        ].join('\n'),
        expectedMode: 'display',
      },
      {
        name: 'closes before a following line of text',
        source: [
          String.raw`\[`,
          String.raw`\begin{aligned}`,
          String.raw`f(x) &= x^2 + 1 \\`,
          String.raw`f'(x) &= 2x`,
          String.raw`\end{aligned}`,
          String.raw`\]`,
          'suffix',
        ].join('\n'),
        expectedValue: [
          '',
          String.raw`\begin{aligned}`,
          String.raw`f(x) &= x^2 + 1 \\`,
          String.raw`f'(x) &= 2x`,
          String.raw`\end{aligned}`,
          '',
        ].join('\n'),
        expectedMode: 'display',
      },
      {
        name: 'parses inside raw HTML for compatibility',
        source: String.raw`<span>\(1+1=2\)</span>`,
        expectedValue: '1+1=2',
        expectedMode: 'inline',
      },
    ])('$name', ({ source, expectedValue, expectedMode }) => {
      const [node] = collectMathNodes(parseMath(source));

      expect(node).toMatchObject({
        type: 'inlineMath',
        value: expectedValue,
      });
      expect(
        (node?.data as { pandocMath?: { mode?: 'inline' | 'display' } } | undefined)?.pandocMath
          ?.mode,
      ).toBe(expectedMode);
    });

    test('parses multiple inline delimiters in order', () => {
      expect(
        collectMathNodes(parseMath(String.raw`a \(1\) b \(2\) c`)).map(({ value }) => value),
      ).toEqual(['1', '2']);
    });

    test.each([
      ['an unclosed delimiter', String.raw`prefix \(1+1=2`],
      ['inline code', 'prefix `\\(1+1=2\\)` suffix'],
      ['fenced code', ['```txt', String.raw`\[1+1=2\]`, '```'].join('\n')],
      ['double-backslash inline delimiters', String.raw`prefix \\(1+1=2\\) suffix`],
      ['double-backslash display delimiters', String.raw`prefix \\[1+1=2\\] suffix`],
    ])('does not parse %s', (_name, source) => {
      expect(collectMathNodes(parseMath(source))).toEqual([]);
    });
  });

  describe('ending repair', () => {
    test.each([
      {
        name: 'repairs a trailing single-dollar expression after closed math',
        source: 'prefix $1+1=2$ suffix $a+b+c',
        expected: ['1+1=2', 'a+b+c'],
      },
      {
        name: 'repairs a minimal trailing numeric expression',
        source: 'interact.$1',
        expected: ['1'],
      },
      {
        name: 'repairs a padded trailing fraction',
        source: String.raw`law: $ \frac{a}{\sin A} = \frac{b}{\sin`,
        expected: [String.raw`\frac{a}{\sin A} = \frac{b}{\sin`],
      },
      {
        name: 'repairs a trailing single-line double-dollar expression as inline',
        source: 'prefix $$F = ma',
        expected: ['F = ma'],
      },
      {
        name: 'repairs a padded operator expression',
        source: 'prefix $ a+b',
        expected: ['a+b'],
      },
      {
        name: 'repairs a padded one-word double-dollar expression',
        source: 'prefix $$ text',
        expected: ['text'],
      },
    ])('$name', ({ source, expected }) => {
      expect(
        collectMathNodes(parseMath(source, { repairEnding: true })).map(({ type, value }) => ({
          type,
          value,
        })),
      ).toEqual(expected.map((value) => ({ type: 'inlineMath', value })));
    });

    test.each([
      ['a single dollar', 'prefix $', 'prefix '],
      ['two dollars', 'prefix $$', 'prefix '],
      ['a whitespace-only double-dollar candidate', 'prefix $$   ', 'prefix '],
    ])(
      'swallows a trailing empty candidate containing %s without creating math',
      (_name, source, visibleText) => {
        const tree = parseMath(source, { repairEnding: true });

        expect(collectMathNodes(tree)).toEqual([]);
        expect(collectVisibleText(tree)).toBe(visibleText);
      },
    );

    test.each([
      ['a narrative single-dollar tail', 'I have$ suffix'],
      ['a narrative double-dollar tail', 'also double $$ is support'],
      ['currency and multiline prose', ['100 $100 das22 $2 23', 'sdsada', 's', '', 's'].join('\n')],
      ['multiline single-dollar content', ['prefix $a', 'continued'].join('\n')],
      ['long unpadded prose', 'prefix$This is ordinary prose.'],
    ])('does not repair %s', (_name, source) => {
      expect(collectMathNodes(parseMath(source, { repairEnding: true }))).toEqual([]);
    });

    test('repairs only the final literal leaf', () => {
      const tree = parseMath(['p1 $a', '', 'p2 $b'].join('\n'), {
        repairEnding: true,
      });

      expect(collectMathNodes(tree).map(({ value }) => value)).toEqual(['b']);
      expect(collectVisibleText(tree)).toContain('p1 $a');
    });

    test('does not repair math before a trailing empty syntax branch', () => {
      const source = ['| $x |  |', '| --- | --- |'].join('\n');
      const tree = parseMarkdown(source, [
        new SyntaxTableRemarkPlugin(),
        new SyntaxMathRemarkPlugin({ repairEnding: true }),
      ]);

      expect(collectMathNodes(tree)).toEqual([]);
      expect(collectVisibleText(tree)).toContain('$x');
    });

    test.each([false, true])(
      'keeps a trailing single dollar inside an existing block-math flow when repairEnding=%s',
      (repairEnding) => {
        expect(
          collectMathNodes(parseMath(['$$', 'aaaa', '$'].join('\n'), { repairEnding })).map(
            ({ type, value }) => ({ type, value }),
          ),
        ).toEqual([{ type: 'math', value: 'aaaa\n$' }]);
      },
    );

    test.each([
      {
        name: 'repairs a trailing unclosed inline Pandoc delimiter',
        source: String.raw`prefix \(V=\frac{1}{3}\times l^2\times h^2\times\frac`,
        expectedValue: String.raw`V=\frac{1}{3}\times l^2\times h^2\times\frac`,
        expectedMode: 'inline',
      },
      {
        name: 'repairs a trailing unclosed display Pandoc delimiter',
        source: String.raw`prefix \[V=\frac{1}{3}\times l^2\times h^2\times\frac`,
        expectedValue: String.raw`V=\frac{1}{3}\times l^2\times h^2\times\frac`,
        expectedMode: 'display',
      },
      {
        name: 'repairs an unclosed multiline display environment',
        source: String.raw`\[
\begin{aligned}
f(x) &= x^2 + 1 \\
f'(x) &= 2x
\end{aligned}`,
        expectedValue: [
          String.raw`\begin{aligned}`,
          String.raw`f(x) &= x^2 + 1 \\`,
          String.raw`f'(x) &= 2x`,
          String.raw`\end{aligned}`,
        ].join('\n'),
        expectedMode: 'display',
      },
      {
        name: 'trims a repaired inline Pandoc candidate',
        source: String.raw`prefix \(  x + y  `,
        expectedValue: 'x + y',
        expectedMode: 'inline',
      },
      {
        name: 'trims a repaired display Pandoc candidate',
        source: String.raw`prefix \[  x + y  `,
        expectedValue: 'x + y',
        expectedMode: 'display',
      },
    ])('$name', ({ source, expectedValue, expectedMode }) => {
      const [node] = collectMathNodes(parseMath(source, { repairEnding: true }));

      expect(node).toMatchObject({
        type: 'inlineMath',
        value: expectedValue,
      });
      expect(
        (node?.data as { pandocMath?: { mode?: 'inline' | 'display' } } | undefined)?.pandocMath
          ?.mode,
      ).toBe(expectedMode);
    });

    test.each([
      ['an empty inline opener', String.raw`prefix \(`, 'prefix '],
      ['a whitespace-only display opener', 'prefix \\[   ', 'prefix '],
    ])('swallows %s without creating math', (_name, source, visibleText) => {
      const tree = parseMath(source, { repairEnding: true });

      expect(collectMathNodes(tree)).toEqual([]);
      expect(collectVisibleText(tree)).toBe(visibleText);
    });

    test.each([
      {
        name: 'a repeated inline opener',
        source: String.raw`prefix \(a \(b`,
        visibleText: 'prefix (a (b',
      },
      {
        name: 'a repeated display opener',
        source: String.raw`prefix \[a \[b`,
        visibleText: 'prefix [a [b',
      },
    ])('falls back to text for $name', ({ source, visibleText }) => {
      const tree = parseMath(source, { repairEnding: true });

      expect(collectMathNodes(tree)).toEqual([]);
      expect(collectVisibleText(tree)).toBe(visibleText);
    });

    test('does not throw when a repaired Pandoc candidate ends after a TeX command backslash', () => {
      const source = '\\(\\frac{1}{2}+\\';

      expect(() => parseMath(source, { repairEnding: true })).not.toThrow();
    });

    test('does not mutate its caller-owned config', () => {
      const config: SyntaxMathRemarkPluginConfig = { repairEnding: true };
      const original = { ...config };
      const plugin = new SyntaxMathRemarkPlugin(config);

      parseMarkdown('prefix $a', [plugin]);

      expect(config).toEqual(original);
    });
  });

  describe('placeholder protocol', () => {
    const placeholderCases: MathPlaceholderCase[] = [
      {
        name: 'bridges inline dollar math',
        source: 'prefix $1+1=2$ suffix',
        config: undefined,
        expected: [{ dataType: 'inline-math', text: '1+1=2' }],
      },
      {
        name: 'bridges single-line double-dollar math as inline',
        source: 'prefix $$d$$ suffix',
        config: undefined,
        expected: [{ dataType: 'inline-math', text: 'd' }],
      },
      {
        name: 'bridges a literal dollar from double-dollar math',
        source: 'prefix $$ $ $$ suffix',
        config: undefined,
        expected: [{ dataType: 'inline-math', text: '$' }],
      },
      {
        name: 'bridges fenced math as block',
        source: ['$$', '1+1=2', '$$'].join('\n'),
        config: undefined,
        expected: [{ dataType: 'block-math', text: '1+1=2' }],
      },
      {
        name: 'bridges repaired single-dollar math',
        source: 'prefix$a+b',
        config: { repairEnding: true },
        expected: [{ dataType: 'inline-math', text: 'a+b' }],
      },
      {
        name: 'bridges repaired padded single-dollar math',
        source: String.raw`law: $ \frac{a}{\sin A} = \frac{b}{\sin`,
        config: { repairEnding: true },
        expected: [
          {
            dataType: 'inline-math',
            text: String.raw`\frac{a}{\sin A} = \frac{b}{\sin`,
          },
        ],
      },
      {
        name: 'bridges repaired double-dollar math as inline',
        source: 'prefix $$F = ma',
        config: { repairEnding: true },
        expected: [{ dataType: 'inline-math', text: 'F = ma' }],
      },
      {
        name: 'bridges repaired inline Pandoc math',
        source: String.raw`prefix\(\frac{a}{\sin A} = \frac{b}{\sin`,
        config: { repairEnding: true },
        expected: [
          {
            dataType: 'inline-math',
            text: String.raw`\frac{a}{\sin A} = \frac{b}{\sin`,
          },
        ],
      },
      {
        name: 'bridges closed inline Pandoc math',
        source: String.raw`prefix \(1+1=2\) suffix`,
        config: undefined,
        expected: [{ dataType: 'inline-math', text: '1+1=2' }],
      },
      {
        name: 'bridges multiple inline expressions in order',
        source: 'a $1$ b $2$ c',
        config: undefined,
        expected: [
          { dataType: 'inline-math', text: '1' },
          { dataType: 'inline-math', text: '2' },
        ],
      },
      {
        name: 'bridges adjacent inline expressions in order',
        source: 'prefix$123123123$$46456456$suffix',
        config: undefined,
        expected: [
          { dataType: 'inline-math', text: '123123123' },
          { dataType: 'inline-math', text: '46456456' },
        ],
      },
      {
        name: 'bridges display Pandoc math as block',
        source: String.raw`prefix \[1+1=2\] suffix`,
        config: undefined,
        expected: [{ dataType: 'block-math', text: '1+1=2' }],
      },
      {
        name: 'preserves display Pandoc whitespace and line endings',
        source: ['prefix \\[ 1', ' 2 \\] suffix'].join('\n'),
        config: undefined,
        expected: [{ dataType: 'block-math', text: ' 1\n 2 ' }],
      },
    ];

    test.each(placeholderCases)('$name', ({ source, config, expected }) => {
      expect(parseMathPlaceholders(source, config)).toEqual(expected);
    });

    test('uses only the camelCase dataType property and a raw text child', () => {
      const tree = markdownToHast({
        text: 'prefix $1+1=2$ suffix',
        remarks: [new SyntaxMathRemarkPlugin()],
      });
      const pending: Array<HastRoot | HastRootContent> = [tree];
      let placeholder: Extract<HastRootContent, { type: 'element' }> | undefined;

      while (pending.length > 0 && !placeholder) {
        const node = pending.shift();

        if (!node) {
          continue;
        }

        if (
          node.type === 'element' &&
          node.tagName === 'span' &&
          node.properties?.dataType === 'inline-math'
        ) {
          placeholder = node;
          break;
        }

        if ('children' in node) {
          pending.push(...node.children);
        }
      }

      expect(placeholder?.properties).toMatchObject({
        dataType: 'inline-math',
      });
      expect(placeholder?.properties && 'data-type' in placeholder.properties).toBe(false);
      expect(placeholder?.properties && 'data-value' in placeholder.properties).toBe(false);
      expect(placeholder?.children).toEqual([{ type: 'text', value: '1+1=2' }]);
    });
  });

  describe('public integration behavior', () => {
    test('appends parser and serializer extensions without replacing existing data', () => {
      const processor = unified().use(remarkParse);
      const data = processor.data() as RemarkExtensionData;
      const existingMicromark = { existing: 'micromark' };
      const existingFromMarkdown = { existing: 'from-markdown' };
      const existingToMarkdown: NonNullable<ToMarkdownOptions['extensions']>[number] = {};

      data.micromarkExtensions = [existingMicromark];
      data.fromMarkdownExtensions = [existingFromMarkdown];
      data.toMarkdownExtensions = [existingToMarkdown];

      processor.use(new SyntaxMathRemarkPlugin().plugin).freeze();

      expect(first(data.micromarkExtensions)).toBe(existingMicromark);
      expect(first(data.fromMarkdownExtensions)).toBe(existingFromMarkdown);
      expect(first(data.toMarkdownExtensions)).toBe(existingToMarkdown);
      expect(data.micromarkExtensions.length).toBeGreaterThan(1);
      expect(data.fromMarkdownExtensions.length).toBeGreaterThan(1);
      expect(data.toMarkdownExtensions?.length).toBeGreaterThan(1);
    });

    test('serializes parsed inline and block math through the registered extension', () => {
      const plugin = new SyntaxMathRemarkPlugin();
      const processor = getAstProcessorByPlugins({ remarks: [plugin] });
      const source = ['a $b$ c', '', '$$', 'd', '$$'].join('\n');
      const tree = processor.runSync(processor.parse(source), source);
      const extensions = (processor.data() as RemarkExtensionData).toMarkdownExtensions;
      const markdown = toMarkdown(tree as MdastRoot, { extensions });

      expect(markdown).toContain('$b$');
      expect(markdown).toMatch(/\$\$\n[\s\S]*?d\n\$\$(?:\n|$)/);
    });

    test('keeps decoded Markdown entities in ordinary text', () => {
      expect(collectVisibleText(parseMath('A &amp; B &#38; C'))).toBe('A & B & C');
    });

    test('preserves text changes made by an earlier remark transformer', () => {
      const processor = unified()
        .use(remarkParse)
        .use(() => (tree: MdastRoot) => {
          const paragraph = first(tree.children);
          const text = paragraph?.type === 'paragraph' ? first(paragraph.children) : undefined;

          if (text?.type === 'text') {
            text.value = 'changed by an earlier plugin';
          }
        })
        .use(new SyntaxMathRemarkPlugin().plugin);
      const source = 'original text';
      const tree = processor.runSync(processor.parse(source), source) as MdastRoot;

      expect(collectVisibleText(tree)).toBe('changed by an earlier plugin');
    });

    test('preserves a preconstructed inlineMath node without source positions', () => {
      const tree: MdastRoot = {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'inlineMath', value: 'x+y' }],
          },
        ],
      };

      runRemarkPlugin(tree, new SyntaxMathRemarkPlugin());

      const [math] = collectMathNodes(tree);

      expect(math).toMatchObject({
        type: 'inlineMath',
        value: 'x+y',
        data: {
          hName: 'span',
          hProperties: { dataType: 'inline-math' },
          hChildren: [{ type: 'text', value: 'x+y' }],
        },
      });
    });

    test('preserves source offsets on math and adjacent text nodes', () => {
      const tree = parseMath('a $x$ b');
      const paragraph = first(tree.children);
      const children = paragraph?.type === 'paragraph' ? paragraph.children : [];

      expect(
        children.map((node) => [node.position?.start.offset, node.position?.end.offset]),
      ).toEqual([
        [0, 2],
        [2, 5],
        [5, 7],
      ]);
    });

    test('exposes Pandoc mode through public MDAST data typing', () => {
      const [math] = collectMathNodes(parseMath(String.raw`\(x\)`));

      expect(math?.data?.pandocMath?.mode).toBe('inline');
    });

    test('degrades an unclosed display delimiter to decoded text when repair is disabled', () => {
      const tree = parseMath(String.raw`prefix \[x`);

      expect(collectMathNodes(tree)).toEqual([]);
      expect(collectVisibleText(tree)).toBe('prefix [x');
    });

    test('handles empty Markdown without output or errors', () => {
      expect(() => parseMath('')).not.toThrow();
      expect(collectMathNodes(parseMath(''))).toEqual([]);
      expect(parseMathPlaceholders('')).toEqual([]);
    });
  });
});
