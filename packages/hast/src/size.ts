import type { Root as HastRoot, RootContent } from 'hast';

import {
  getIgnoredTableWhitespaceIndexes,
  isTableColumnDefinition,
  isTableStructureTagName,
  isTableWhitespace,
} from './base';
import { getTextUnits, isHiddenTagName } from './content';

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

/** Counts visible content units using the same text and table rules as sliceHast. */
export const sizeOfHast = (root: HastRoot): number => {
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
