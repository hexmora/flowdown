import type { Element, ElementContent, RootContent } from 'hast';

import { ceil, floor, isArray, isNaN, max } from 'lodash-es';

import type { HastRoot } from '../../../../typings';

import {
  cloneTextFragment,
  getIgnoredTableWhitespaceIndexes,
  getTextUnits,
  isHiddenTagName,
  isTableColumnDefinition,
  isTableStructureTagName,
} from './content-model';

type SliceFrame = {
  node: HastRoot | Element;
  children: readonly RootContent[];
  childIndex: number;
  output: ElementContent[];
  ignoredTableWhitespace: readonly number[];
  tableDepth: number;
  hasSelection: boolean;
};

const normalizeIndex = (index: number) => {
  return index < 0 ? ceil(index) : floor(index);
};

/**
 * Copies a half-open visible range while retaining its ancestor paths. Table
 * structure is kept as zero-width context so sliced cells stay aligned.
 */
export const sliceHast = (
  root: HastRoot,
  startIndex: number,
  endIndex: number,
): HastRoot | null => {
  if (
    !root ||
    typeof root !== 'object' ||
    root.type !== 'root' ||
    !isArray(root.children) ||
    isNaN(startIndex) ||
    isNaN(endIndex)
  ) {
    return null;
  }

  const start = max([0, normalizeIndex(startIndex)]) ?? 0;
  const end = normalizeIndex(endIndex);

  if (start === Infinity || end <= start) {
    return null;
  }

  const frames: SliceFrame[] = [
    {
      node: root,
      children: root.children,
      childIndex: 0,
      output: [],
      ignoredTableWhitespace: getIgnoredTableWhitespaceIndexes(undefined, root.children),
      tableDepth: 0,
      hasSelection: false,
    },
  ];
  let cursor = 0;
  let result: HastRoot | null = null;

  while (frames.length > 0) {
    const frame = frames[frames.length - 1];

    if (!frame) {
      break;
    }

    if (cursor >= end && frame.tableDepth === 0) {
      frame.childIndex = frame.children.length;
    }

    if (frame.childIndex >= frame.children.length) {
      frames.pop();

      if (frame.node.type === 'root') {
        if (frame.hasSelection) {
          result = {
            ...frame.node,
            children: frame.output,
          };
        }

        continue;
      }

      const parentFrame = frames[frames.length - 1];
      const belongsToRetainedTable =
        parentFrame !== undefined &&
        frame.tableDepth > 0 &&
        parentFrame.tableDepth === frame.tableDepth &&
        isTableStructureTagName(frame.node.tagName);

      if (parentFrame && (frame.hasSelection || belongsToRetainedTable)) {
        parentFrame.output.push({
          ...frame.node,
          children: frame.output,
        });

        if (frame.hasSelection) {
          parentFrame.hasSelection = true;
        }
      }

      continue;
    }

    const childIndex = frame.childIndex;
    const node = frame.children[childIndex];
    frame.childIndex += 1;

    if (!node) {
      continue;
    }

    if (node.type === 'text') {
      if (cursor >= end) {
        continue;
      }

      if (frame.ignoredTableWhitespace.includes(childIndex)) {
        continue;
      }

      const selectedUnits: string[] = [];

      for (const unit of getTextUnits(node.value)) {
        if (cursor >= end) {
          break;
        }

        if (cursor >= start) {
          selectedUnits.push(unit);
        }

        cursor += 1;
      }

      if (selectedUnits.length > 0) {
        frame.output.push(cloneTextFragment(node, selectedUnits.join('')));
        frame.hasSelection = true;
      }

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
      if (frame.tableDepth > 0) {
        frame.output.push({
          ...node,
          children: [],
        });
      }

      continue;
    }

    if (node.children.length === 0) {
      if (isTableStructureTagName(tagName)) {
        if (frame.tableDepth > 0 && tagName !== 'table') {
          frame.output.push({
            ...node,
            children: [],
          });
        }

        continue;
      }

      if (cursor >= end) {
        continue;
      }

      const nodeStart = cursor;
      cursor += 1;

      if (nodeStart >= start && nodeStart < end) {
        frame.output.push({
          ...node,
          children: [],
        });
        frame.hasSelection = true;
      }

      continue;
    }

    if (cursor >= end && (tagName === 'table' || !isTableStructureTagName(tagName))) {
      continue;
    }

    frames.push({
      node,
      children: node.children,
      childIndex: 0,
      output: [],
      ignoredTableWhitespace: getIgnoredTableWhitespaceIndexes(tagName, node.children),
      tableDepth: frame.tableDepth + (tagName === 'table' ? 1 : 0),
      hasSelection: false,
    });
  }

  return result;
};
