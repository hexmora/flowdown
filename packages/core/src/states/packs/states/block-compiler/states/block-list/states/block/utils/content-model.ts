import type { RootContent, Text } from 'hast';

import { uniq } from 'lodash-es';

// oxlint-disable-next-line unicorn/prefer-set-has -- Fixed lookup tables use arrays by convention.
const HIDDEN_TAG_NAMES = ['script', 'style', 'template'];

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
const TABLE_LAYOUT_TAG_NAMES = ['colgroup', 'table', 'tbody', 'tfoot', 'thead', 'tr'];

const PRESERVED_WHITESPACE_DATA_KEY = 'flowdownPreservedWhitespace';

const SEGMENTER =
  typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function'
    ? null
    : new Intl.Segmenter(undefined, {
        granularity: 'grapheme',
      });

const isWhitespaceWithLineBreak = (value: string) => {
  return value.trim().length === 0 && /[\r\n]/.test(value);
};

export const getTextUnits = function* (value: string): Generator<string> {
  if (!SEGMENTER) {
    yield* value;
    return;
  }

  for (const { segment } of SEGMENTER.segment(value)) {
    yield segment;
  }
};

export const isHiddenTagName = (tagName: string) => {
  return HIDDEN_TAG_NAMES.includes(tagName.toLowerCase());
};

export const isTableStructureTagName = (tagName: string) => {
  return TABLE_STRUCTURE_TAG_NAMES.includes(tagName.toLowerCase());
};

export const isTableColumnDefinition = (tagName: string) => {
  return tagName.toLowerCase() === 'col';
};

export const isTableWhitespace = (node: Text) => {
  const data = node.data as Record<string, unknown> | undefined;

  return data?.[PRESERVED_WHITESPACE_DATA_KEY] !== true && isWhitespaceWithLineBreak(node.value);
};

export const getIgnoredTableWhitespaceIndexes = (
  parentTagName: string | undefined,
  children: readonly RootContent[],
) => {
  const result: number[] = [];

  if (parentTagName !== undefined && TABLE_LAYOUT_TAG_NAMES.includes(parentTagName.toLowerCase())) {
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];

      if (child?.type === 'text' && isTableWhitespace(child)) {
        result.push(index);
      }
    }

    return result;
  }

  const scan = (start: number, end: number, step: -1 | 1) => {
    let tableIsReachable = false;

    for (let index = start; index !== end; index += step) {
      const sibling = children[index];

      if (!sibling) {
        continue;
      }

      if (sibling.type === 'element') {
        tableIsReachable = isTableStructureTagName(sibling.tagName);
        continue;
      }

      if (sibling.type === 'text') {
        if (sibling.value.length === 0) {
          continue;
        }

        if (isTableWhitespace(sibling)) {
          if (tableIsReachable) {
            result.push(index);
          }

          continue;
        }

        tableIsReachable = false;
        continue;
      }

      if (sibling.type !== 'comment' && sibling.type !== 'doctype') {
        tableIsReachable = false;
      }
    }
  };

  scan(0, children.length, 1);
  scan(children.length - 1, -1, -1);

  return uniq(result);
};

export const cloneTextFragment = (node: Text, value: string): Text => {
  if (!isWhitespaceWithLineBreak(value)) {
    return {
      ...node,
      value,
    };
  }

  return {
    ...node,
    value,
    data: {
      ...node.data,
      [PRESERVED_WHITESPACE_DATA_KEY]: true,
    },
  };
};
