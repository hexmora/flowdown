import type { RootContent } from 'hast';

import { isNaN, max } from 'lodash-es';

import type { HastRoot } from '../../../../typings';

import {
  getIgnoredTableWhitespaceIndexes,
  getTextUnits,
  isHiddenTagName,
  isTableColumnDefinition,
  isTableStructureTagName,
  isTableWhitespace,
} from './content-model';

const getTextLength = (value: string) => {
  let length = 0;

  for (const unit of getTextUnits(value)) {
    if (unit.length > 0) {
      length += 1;
    }
  }

  return length;
};

type NodeEntry = {
  node: RootContent;
  ignoreFormattingWhitespace: boolean;
};

export type VisibleIndexLocation = {
  blockIndex: number;
  localIndex: number;
};

export const findVisibleIndex = (
  blockLengths: readonly number[],
  visibleIndex: number,
): VisibleIndexLocation | null => {
  if (blockLengths.length === 0 || isNaN(visibleIndex)) {
    return null;
  }

  const targetIndex = max([0, visibleIndex]) ?? 0;

  if (targetIndex === 0) {
    return {
      blockIndex: 0,
      localIndex: 0,
    };
  }

  let blockStart = 0;

  const blockIndex = blockLengths.findIndex((blockLength) => {
    const normalizedLength = blockLength > 0 ? blockLength : 0;
    const blockEnd = blockStart + normalizedLength;

    if (targetIndex < blockEnd) {
      return true;
    }

    blockStart = blockEnd;
    return false;
  });

  if (blockIndex < 0) {
    return null;
  }

  return {
    blockIndex,
    localIndex: targetIndex - blockStart,
  };
};

export const getLengthOfHast = (root: HastRoot): number => {
  const ignoredRootWhitespace = getIgnoredTableWhitespaceIndexes(undefined, root.children);
  const nodes: NodeEntry[] = root.children.map((node, childIndex) => ({
    node,
    ignoreFormattingWhitespace: ignoredRootWhitespace.includes(childIndex),
  }));
  let length = 0;

  while (nodes.length > 0) {
    const entry = nodes.pop();

    if (!entry) {
      continue;
    }

    const { node, ignoreFormattingWhitespace } = entry;

    if (node.type === 'text') {
      if (ignoreFormattingWhitespace && isTableWhitespace(node)) {
        continue;
      }

      length += getTextLength(node.value);
      continue;
    }

    if (node.type !== 'element') {
      continue;
    }

    const tagName = node.tagName.toLowerCase();

    if (isHiddenTagName(tagName)) {
      continue;
    }

    if (isTableColumnDefinition(tagName)) {
      continue;
    }

    if (node.children.length === 0) {
      if (!isTableStructureTagName(tagName)) {
        length += 1;
      }

      continue;
    }

    const ignoredChildWhitespace = getIgnoredTableWhitespaceIndexes(tagName, node.children);

    for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
      const child = node.children[childIndex];

      if (!child) {
        continue;
      }

      nodes.push({
        node: child,
        ignoreFormattingWhitespace: ignoredChildWhitespace.includes(childIndex),
      });
    }
  }

  return length;
};
