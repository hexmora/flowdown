import type { Data, Parent, Root, RootContent, Text } from 'mdast';
import type { InlineMath } from 'mdast-util-math';
import type { Point, Position } from 'unist';

import { first, last } from 'lodash-es';
import { fromMarkdown } from 'mdast-util-from-markdown';

import {
  BLOCK_MATH_PLACEHOLDER,
  INLINE_MATH_PLACEHOLDER,
  MARKDOWN_DECODE_SENTINEL,
  MATH_OPERATOR_PATTERN,
  PANDOC_DISPLAY_CLOSE,
  PANDOC_DISPLAY_OPEN,
  PANDOC_INLINE_CLOSE,
  PANDOC_INLINE_OPEN,
} from './consts';

type PandocMode = 'inline' | 'display';

type ParsedContent = RootContent[];

type MathLiteral = InlineMath | Text;

type MathData = Data;

interface DollarCloseCache {
  adjacentValidity: Array<boolean | undefined>;
  inlineResults: Array<number | undefined>;
}

const decodeMarkdownText = (value: string): string => {
  const root = fromMarkdown(`${MARKDOWN_DECODE_SENTINEL}${value}${MARKDOWN_DECODE_SENTINEL}`);
  const pending: Array<Root | RootContent> = [root];
  const values: string[] = [];

  while (pending.length > 0) {
    const node = pending.pop();

    if (!node) {
      continue;
    }

    if (node.type === 'text') {
      values.push(node.value);
      continue;
    }

    if ('children' in node) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        const child = node.children[index];

        if (child) {
          pending.push(child);
        }
      }
    }
  }

  return values.join('').slice(MARKDOWN_DECODE_SENTINEL.length, -MARKDOWN_DECODE_SENTINEL.length);
};

const isEscaped = (value: string, index: number): boolean => {
  let backslashes = 0;

  for (let offset = index - 1; offset >= 0 && value[offset] === '\\'; offset -= 1) {
    backslashes += 1;
  }

  return backslashes % 2 === 1;
};

const countDollarRun = (value: string, index: number): number => {
  let length = 0;

  while (value[index + length] === '$') {
    length += 1;
  }

  return length;
};

const pointAtOffset = (source: string, offset: number): Point => {
  let line = 1;
  let column = 1;

  for (let index = 0; index < offset; index += 1) {
    const character = source[index];

    if (character === '\r' && source[index + 1] === '\n') {
      index += 1;
      line += 1;
      column = 1;
    } else if (character === '\r' || character === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { line, column, offset };
};

const createPosition = (source: string, start: number, end: number): Position => {
  return {
    start: pointAtOffset(source, start),
    end: pointAtOffset(source, end),
  };
};

const createPlaceholderData = (
  value: string,
  dataType: typeof INLINE_MATH_PLACEHOLDER | typeof BLOCK_MATH_PLACEHOLDER,
  data: MathData = {},
): MathData => {
  return {
    ...data,
    hName: 'span',
    hProperties: {
      dataType,
    },
    hChildren: [{ type: 'text', value }],
  };
};

const createInlineMath = (
  value: string,
  pandocMode?: PandocMode,
  position?: Position,
): InlineMath => {
  const data: MathData = pandocMode
    ? {
        pandocMath: {
          mode: pandocMode,
        },
      }
    : {};

  return {
    type: 'inlineMath',
    value,
    data: createPlaceholderData(
      value,
      pandocMode === 'display' ? BLOCK_MATH_PLACEHOLDER : INLINE_MATH_PLACEHOLDER,
      data,
    ),
    position,
  };
};

const appendText = (content: ParsedContent, value: string, position?: Position): void => {
  if (!value) {
    return;
  }

  const previous = last(content);

  if (previous?.type === 'text') {
    previous.value += value;

    if (previous.position && position) {
      previous.position.end = position.end;
    }

    return;
  }

  content.push({
    type: 'text',
    value,
    position,
  });
};

const getOpeningPadding = (value: string): string | undefined => {
  if (value.startsWith('\r\n')) {
    return '\r\n';
  }

  if (value.startsWith('\n')) {
    return '\n';
  }

  return value.startsWith(' ') ? ' ' : undefined;
};

const getClosingPadding = (value: string): string | undefined => {
  if (value.endsWith('\r\n')) {
    return '\r\n';
  }

  if (value.endsWith('\n')) {
    return '\n';
  }

  return value.endsWith(' ') ? ' ' : undefined;
};

const normalizeClosedDollarValue = (value: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const openingPadding = getOpeningPadding(value);
  const closingPadding = getClosingPadding(value);
  const startsWhitespace = /^\s/.test(value);
  const endsWhitespace = /\s$/.test(value);

  if (startsWhitespace !== endsWhitespace) {
    return undefined;
  }

  if (startsWhitespace && (!openingPadding || openingPadding !== closingPadding)) {
    return undefined;
  }

  const normalized = openingPadding
    ? value.slice(openingPadding.length, -openingPadding.length)
    : value;

  return normalized.trim() === normalized && normalized.length > 0 ? normalized : undefined;
};

const normalizeRepairedDollarValue = (
  value: string,
  delimiterLength: number,
): string | undefined => {
  if (/[\r\n]/.test(value)) {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return '';
  }

  const eligible =
    !/\s/.test(normalized) || normalized.startsWith('\\') || MATH_OPERATOR_PATTERN.test(normalized);

  if (!eligible) {
    return undefined;
  }

  if (/^\s/.test(value)) {
    const eligibleSingle = normalized.startsWith('\\') || MATH_OPERATOR_PATTERN.test(normalized);
    const eligibleDouble = !/\s/.test(normalized);

    if (delimiterLength === 1 ? !eligibleSingle : !eligibleDouble) {
      return undefined;
    }
  }

  return normalized;
};

const findPandocClose = (value: string, start: number, close: string): number => {
  for (let index = start; index < value.length - 1; index += 1) {
    if (value.startsWith(close, index) && !isEscaped(value, index)) {
      return index;
    }
  }

  return -1;
};

const findDollarClose = (
  value: string,
  start: number,
  delimiterLength: number,
  cache: DollarCloseCache,
): number => {
  if (delimiterLength === 1) {
    const cached = cache.inlineResults[start];

    if (cached !== undefined) {
      return cached;
    }
  }

  let closeIndex = -1;

  for (let index = start; index < value.length; index += 1) {
    if (value[index] !== '$' || isEscaped(value, index)) {
      continue;
    }

    const runLength = countDollarRun(value, index);

    if (delimiterLength === 1 && runLength === 1) {
      if (value[index - 1] !== '$') {
        closeIndex = index;
        break;
      }
    }

    if (delimiterLength === 1 && runLength === 2) {
      let adjacentValid = cache.adjacentValidity[index];

      if (adjacentValid === undefined) {
        const adjacentValueStart = index + 2;
        const adjacentClose = findDollarClose(value, adjacentValueStart, 1, cache);

        if (adjacentClose === -1) {
          adjacentValid = false;
        } else {
          const adjacentValue = normalizeClosedDollarValue(
            value.slice(adjacentValueStart, adjacentClose),
          );
          const adjacentNext = adjacentClose + 1;

          adjacentValid = adjacentValue !== undefined && !/\d/.test(value[adjacentNext] ?? '');
        }

        cache.adjacentValidity[index] = adjacentValid;
      }

      if (adjacentValid) {
        closeIndex = index;
        break;
      }
    }

    if (delimiterLength === 2 && runLength === 2) {
      closeIndex = index;
      break;
    }

    index += runLength - 1;
  }

  if (delimiterLength === 1) {
    cache.inlineResults[start] = closeIndex;
  }

  return closeIndex;
};

const sourceForNode = (node: RootContent, source: string): string => {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;

  if (typeof start === 'number' && typeof end === 'number' && source.length >= end) {
    return source.slice(start, end);
  }

  return 'value' in node && typeof node.value === 'string' ? node.value : '';
};

const sourceForLiterals = (
  nodes: MathLiteral[],
  source: string,
): { offset: number | undefined; value: string } => {
  const initial = first(nodes);
  const final = last(nodes);
  const start = initial?.position?.start.offset;
  const end = final?.position?.end.offset;

  if (typeof start === 'number' && typeof end === 'number' && source.length >= end) {
    return {
      offset: start,
      value: source.slice(start, end),
    };
  }

  return {
    offset: undefined,
    value: nodes.map((node) => sourceForNode(node, source)).join(''),
  };
};

const isMathLiteral = (node: RootContent): node is MathLiteral => {
  return node.type === 'text' || node.type === 'inlineMath';
};

const hasMathSyntaxCandidate = (value: string): boolean => {
  return (
    value.includes('$') || value.includes(PANDOC_INLINE_OPEN) || value.includes(PANDOC_DISPLAY_OPEN)
  );
};

const hasChangedText = (nodes: MathLiteral[], source: string): boolean => {
  return nodes.some((node) => {
    if (node.type !== 'text') {
      return false;
    }

    const start = node.position?.start.offset;
    const end = node.position?.end.offset;

    return (
      typeof start === 'number' &&
      typeof end === 'number' &&
      node.value !== decodeMarkdownText(source.slice(start, end))
    );
  });
};

const bridgeInlineMath = (math: InlineMath): void => {
  const mode = math.data?.pandocMath?.mode;

  math.data = createPlaceholderData(
    math.value,
    mode === 'display' ? BLOCK_MATH_PLACEHOLDER : INLINE_MATH_PLACEHOLDER,
    math.data,
  );
};

const hasRepeatedPandocOpen = (value: string, open: string): boolean => {
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value.startsWith(open, index) && !isEscaped(value, index)) {
      return true;
    }
  }

  return false;
};

const parseLiteral = (
  raw: string,
  repairEnding: boolean,
  source: string,
  sourceOffset: number,
): { content: ParsedContent; preserveFallback: boolean } => {
  const dollarCloseCache: DollarCloseCache = {
    adjacentValidity: [],
    inlineResults: [],
  };
  const content: ParsedContent = [];
  let textStart = 0;
  let index = 0;
  let adjacentOpenIndex = -1;

  const flushText = (end: number): void => {
    appendText(
      content,
      decodeMarkdownText(raw.slice(textStart, end)),
      createPosition(source, sourceOffset + textStart, sourceOffset + end),
    );
  };

  while (index < raw.length) {
    const pandocMode: PandocMode | undefined = raw.startsWith(PANDOC_INLINE_OPEN, index)
      ? 'inline'
      : raw.startsWith(PANDOC_DISPLAY_OPEN, index)
        ? 'display'
        : undefined;

    if (pandocMode && !isEscaped(raw, index)) {
      const open = pandocMode === 'inline' ? PANDOC_INLINE_OPEN : PANDOC_DISPLAY_OPEN;
      const close = pandocMode === 'inline' ? PANDOC_INLINE_CLOSE : PANDOC_DISPLAY_CLOSE;
      const valueStart = index + open.length;
      const closeIndex = findPandocClose(raw, valueStart, close);

      if (closeIndex !== -1) {
        flushText(index);
        content.push(
          createInlineMath(
            raw.slice(valueStart, closeIndex),
            pandocMode,
            createPosition(source, sourceOffset + index, sourceOffset + closeIndex + close.length),
          ),
        );
        index = closeIndex + close.length;
        textStart = index;
        continue;
      }

      if (repairEnding) {
        const candidate = raw.slice(valueStart);

        if (hasRepeatedPandocOpen(candidate, open)) {
          return {
            content: [],
            preserveFallback: true,
          };
        }

        flushText(index);

        if (candidate.trim()) {
          const repairedCandidate = candidate.trim();

          content.push(
            createInlineMath(
              repairedCandidate,
              pandocMode,
              createPosition(source, sourceOffset + index, sourceOffset + raw.length),
            ),
          );
        }

        index = raw.length;
        textStart = index;
        continue;
      }
    }

    if (
      raw[index] === '$' &&
      !isEscaped(raw, index) &&
      (raw[index - 1] !== '$' || isEscaped(raw, index - 1) || index === adjacentOpenIndex)
    ) {
      const delimiterLength = countDollarRun(raw, index);

      if (delimiterLength === 1 || delimiterLength === 2) {
        const valueStart = index + delimiterLength;
        const closeIndex = findDollarClose(raw, valueStart, delimiterLength, dollarCloseCache);

        if (closeIndex !== -1) {
          const normalized = normalizeClosedDollarValue(raw.slice(valueStart, closeIndex));
          const next = closeIndex + delimiterLength;
          const followedByDigit = delimiterLength === 1 && /\d/.test(raw[next] ?? '');

          if (normalized !== undefined && !followedByDigit) {
            flushText(index);
            content.push(
              createInlineMath(
                normalized,
                undefined,
                createPosition(
                  source,
                  sourceOffset + index,
                  sourceOffset + closeIndex + delimiterLength,
                ),
              ),
            );
            adjacentOpenIndex =
              delimiterLength === 1 && raw[closeIndex + 1] === '$' ? closeIndex + 1 : -1;
            index = next;
            textStart = index;
            continue;
          }
        } else if (repairEnding) {
          const normalized = normalizeRepairedDollarValue(raw.slice(valueStart), delimiterLength);

          if (normalized !== undefined) {
            flushText(index);

            if (normalized) {
              content.push(
                createInlineMath(
                  normalized,
                  undefined,
                  createPosition(source, sourceOffset + index, sourceOffset + raw.length),
                ),
              );
            }

            index = raw.length;
            textStart = index;
            continue;
          }
        }
      }
    }

    index += 1;
  }

  flushText(raw.length);

  return { content, preserveFallback: false };
};

const findFinalRepairLeaf = (node: Root | RootContent): RootContent | undefined => {
  if ('children' in node) {
    let index = node.children.length - 1;

    while (index >= 0 && node.children[index]?.type === 'parserPatch') {
      index -= 1;
    }

    const child = node.children[index];

    return child ? findFinalRepairLeaf(child) : undefined;
  }

  return node;
};

const processParent = (
  parent: Parent,
  source: string,
  repairTarget: RootContent | undefined,
): void => {
  const children = parent.children.slice();

  for (const child of children) {
    if ('children' in child) {
      processParent(child, source, repairTarget);
    }
  }

  const nextChildren: RootContent[] = [];

  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];

    if (!child) {
      continue;
    }

    if (child.type === 'text' || child.type === 'inlineMath') {
      if (child.type === 'inlineMath' && !child.position) {
        bridgeInlineMath(child);
        nextChildren.push(child);
        continue;
      }

      const literals = [child];

      while (index + 1 < parent.children.length) {
        const next = parent.children[index + 1];

        if (!next || !isMathLiteral(next)) {
          break;
        }

        literals.push(next);
        index += 1;
      }

      const literalSource = sourceForLiterals(literals, source);

      if (
        literalSource.offset === undefined ||
        !hasMathSyntaxCandidate(literalSource.value) ||
        hasChangedText(literals, source)
      ) {
        for (const literal of literals) {
          if (literal.type === 'inlineMath') {
            bridgeInlineMath(literal);
          }

          nextChildren.push(literal);
        }

        continue;
      }

      const parsed = parseLiteral(
        literalSource.value,
        literals.some((literal) => literal === repairTarget),
        source,
        literalSource.offset,
      );

      if (parsed.preserveFallback) {
        nextChildren.push(...literals);
      } else {
        nextChildren.push(...parsed.content);
      }

      continue;
    }

    if (child.type === 'math') {
      child.data = createPlaceholderData(child.value, BLOCK_MATH_PLACEHOLDER, child.data);
    }

    nextChildren.push(child);
  }

  parent.children = nextChildren;
};

export const transformMath = (tree: Root, source: string, repairEnding: boolean): void => {
  const finalLeaf = findFinalRepairLeaf(tree);
  const repairTarget =
    repairEnding && (finalLeaf?.type === 'text' || finalLeaf?.type === 'inlineMath')
      ? finalLeaf
      : undefined;

  processParent(tree, source, repairTarget);
};
