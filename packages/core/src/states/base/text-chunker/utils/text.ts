import type { IRawPatchItem } from '@flowdown/types';

import { keys, last } from 'lodash-es';
import { Marked, type Token } from 'marked';

import type { IBlockSection } from '../type';

import { chunkPatchesByTexts } from './patches';

export const buildBlockSections = ([currentTexts, currentPatches]: [
  string[],
  IRawPatchItem[],
]): IBlockSection[] => {
  const patchGroups = chunkPatchesByTexts(currentPatches, currentTexts);

  return currentTexts.map((text, index) => ({
    text,
    patches: patchGroups[index] ?? [],
  }));
};

const DISPLAY_MATH_TOKEN = 'flowdown_display_math';

// oxlint-disable-next-line unicorn/prefer-set-has -- Fixed lookup tables use arrays by convention.
const TABLE_INTERRUPT_TOKENS = [
  DISPLAY_MATH_TOKEN,
  'blockquote',
  'code',
  'def',
  'heading',
  'hr',
  'html',
  'list',
];

const isEscaped = (text: string, index: number): boolean => {
  let backslashes = 0;

  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }

  return backslashes % 2 === 1;
};

const findUnescapedDoubleDollar = (text: string): number => {
  for (let index = 0; index < text.length - 1; index += 1) {
    if (text[index] !== '$' || text[index + 1] !== '$') {
      continue;
    }

    if (!isEscaped(text, index)) {
      return index;
    }
  }

  return -1;
};

const readDisplayMath = (source: string): string | undefined => {
  const opening = /^( {0,3})(\$\$(?!\$)|\\\[)([^\n]*)(\n|$)/.exec(source);

  if (!opening) {
    return undefined;
  }

  const marker = opening[2];
  const restOfOpeningLine = opening[3];
  const openingRaw = opening[0];

  if (marker === '\\[' && restOfOpeningLine.trim() !== '') {
    return undefined;
  }

  if (marker === '$$') {
    const closingIndex = findUnescapedDoubleDollar(restOfOpeningLine);

    if (closingIndex >= 0) {
      return undefined;
    }
  }

  const closingLine = marker === '$$' ? /^ {0,3}\$\$[\t ]*$/ : /^ {0,3}\\\][\t ]*$/;
  let lineStart = openingRaw.length;

  while (lineStart < source.length) {
    const newline = source.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? source.length : newline;
    const line = source.slice(lineStart, lineEnd);

    if (closingLine.test(line)) {
      return source.slice(0, newline < 0 ? lineEnd : newline + 1);
    }

    if (newline < 0) {
      break;
    }

    lineStart = newline + 1;
  }

  return source;
};

const markdownLexer = new Marked({
  gfm: true,
  extensions: [
    {
      name: DISPLAY_MATH_TOKEN,
      level: 'block',
      start(source) {
        const match = /\n {0,3}(?:\$\$(?!\$)|\\\[)/.exec(source);

        if (!match) {
          return undefined;
        }

        return match.index + 1;
      },
      tokenizer(source) {
        const raw = readDisplayMath(source);

        if (!raw) {
          return undefined;
        }

        return {
          type: DISPLAY_MATH_TOKEN,
          raw,
          text: raw,
        };
      },
    },
  ],
});

const hasUnescapedPipe = (line: string): boolean => {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '|' && !isEscaped(line, index)) {
      return true;
    }
  }

  return false;
};

/** Narrows marked's permissive table body to explicit row-looking lines. */
const strictTableRawLength = (raw: string): number => {
  let lineNumber = 0;
  let lineStart = 0;

  while (lineStart < raw.length) {
    const newline = raw.indexOf('\n', lineStart);
    const lineEnd = newline < 0 ? raw.length : newline;
    const line = raw.slice(lineStart, lineEnd);

    if (lineNumber >= 2) {
      if (!hasUnescapedPipe(line)) {
        return lineStart;
      }

      const token = markdownLexer.lexer(line)[0];

      if (token && TABLE_INTERRUPT_TOKENS.includes(token.type)) {
        return lineStart;
      }
    }

    lineNumber += 1;

    if (newline < 0) {
      break;
    }

    lineStart = newline + 1;
  }

  return raw.length;
};

type TokenTree = {
  type: string;
  raw: string;
  tokens?: Token[];
  items?: Array<{ tokens: Token[] }>;
  header?: Array<{ tokens: Token[] }>;
  rows?: Array<Array<{ tokens: Token[] }>>;
};

const hasFootnoteReference = (text: string): boolean => {
  let opening = text.indexOf('[^');

  while (opening >= 0) {
    let size = 0;

    for (let index = opening + 2; index < text.length; index += 1) {
      const character = text[index];

      if (character === ']') {
        if (size > 0) {
          return true;
        }

        break;
      }

      if (
        character === '[' ||
        character === ' ' ||
        character === '\t' ||
        character === '\n' ||
        size >= 1_000
      ) {
        break;
      }

      if (character === '\\' && /[[\]\\]/.test(text[index + 1] ?? '')) {
        index += 1;
      }

      size += 1;
    }

    opening = text.indexOf('[^', opening + 2);
  }

  return false;
};

const hasDocumentScopedSyntax = (token: Token): boolean => {
  const tree = token as TokenTree;

  if (
    tree.type === 'code' ||
    tree.type === 'codespan' ||
    tree.type === 'image' ||
    tree.type === 'link' ||
    tree.type === DISPLAY_MATH_TOKEN
  ) {
    return false;
  }

  if (tree.type === 'def') {
    return true;
  }

  if (tree.type === 'text' && (!tree.tokens || tree.tokens.length === 0)) {
    return hasFootnoteReference(tree.raw);
  }

  if (tree.tokens?.some(hasDocumentScopedSyntax)) {
    return true;
  }

  if (tree.items?.some((item) => item.tokens.some(hasDocumentScopedSyntax))) {
    return true;
  }

  const tableCells = [...(tree.header ?? []), ...(tree.rows?.flat() ?? [])];
  return tableCells.some((cell) => cell.tokens.some(hasDocumentScopedSyntax));
};

type NormalizedMarkdown = {
  markdown: string;
  originalOffsets?: number[];
};

const normalizeLineEndings = (text: string): NormalizedMarkdown => {
  if (!text.includes('\r')) {
    return { markdown: text };
  }

  let markdown = '';
  const originalOffsets = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\r') {
      if (text[index + 1] === '\n') {
        index += 1;
      }

      markdown += '\n';
    } else {
      markdown += text[index];
    }

    originalOffsets.push(index + 1);
  }

  return { markdown, originalOffsets };
};

type RootToken = {
  token: Token;
  start: number;
  end: number;
};

type RootTokenResult = {
  hasLinks: boolean;
  rootTokens: RootToken[];
};

const readRootTokens = (markdown: string): RootTokenResult | undefined => {
  const rootTokens: RootToken[] = [];
  let hasLinks = false;

  const appendSource = (source: string, offset: number): boolean => {
    const tokens = markdownLexer.lexer(source);
    let cursor = 0;

    hasLinks ||= keys(tokens.links).length > 0;

    for (const token of tokens) {
      if (token.raw.length === 0 || !source.startsWith(token.raw, cursor)) {
        return false;
      }

      const tableLength =
        token.type === 'table' ? strictTableRawLength(token.raw) : token.raw.length;

      if (tableLength <= 0) {
        return false;
      }

      if (tableLength < token.raw.length) {
        const table = token.raw.slice(0, tableLength);
        const tail = token.raw.slice(tableLength);

        // Re-lex only the text that marked greedily classified as table rows.
        if (
          !appendSource(table, offset + cursor) ||
          !appendSource(tail, offset + cursor + tableLength)
        ) {
          return false;
        }
      } else {
        rootTokens.push({
          token,
          start: offset + cursor,
          end: offset + cursor + token.raw.length,
        });
      }

      cursor += token.raw.length;
    }

    return cursor === source.length;
  };

  if (!appendSource(markdown, 0)) {
    return undefined;
  }

  return { hasLinks, rootTokens };
};

/**
 * Chunks Markdown at root block boundaries while preserving the source exactly.
 */
export const chunkTextOfMarkdown = (text: string): string[] => {
  if (text === '') {
    return [];
  }

  const { markdown, originalOffsets } = normalizeLineEndings(text);
  const result = readRootTokens(markdown);

  if (!result) {
    return [text];
  }

  const { hasLinks, rootTokens } = result;

  if (hasLinks || rootTokens.some(({ token }) => hasDocumentScopedSyntax(token))) {
    return [text];
  }

  const spans: Array<{ start: number; end: number }> = [];

  for (const { token, start, end } of rootTokens) {
    if (token.type === 'space') {
      const previous = last(spans);

      if (previous) {
        previous.end = end;
      }

      continue;
    }

    spans.push({
      start: spans.length === 0 ? 0 : start,
      end,
    });
  }

  if (spans.length === 0) {
    return [text];
  }

  return spans.map(({ start, end }) => {
    return text.slice(originalOffsets?.[start] ?? start, originalOffsets?.[end] ?? end);
  });
};
