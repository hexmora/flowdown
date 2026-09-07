import type { Element, Root as HastRoot, RootContent } from 'hast';

import { getLengthOfHast, getTextUnits, isHiddenTagName } from '@flowdown/utils';

import { BLOCK_TAG_NAMES, BOUNDARY_TAG_NAMES, FORBIDDEN_TAG_NAMES } from './consts';

type TailFrame = {
  parent: HastRoot | Element;
  childIndex: number;
  hasSuffix: boolean;
  hasTarget: boolean;
};

type TailText = {
  path: number[];
  offset: number;
};

const isPatch = (node: RootContent | undefined) => {
  return node?.type === 'element' && node.properties.dataParserPatch === '1';
};

const isForbidden = (node: Element) => {
  return (
    FORBIDDEN_TAG_NAMES.includes(node.tagName.toLowerCase()) ||
    node.properties.dataType === 'inline-math' ||
    node.properties.dataType === 'block-math' ||
    isPatch(node)
  );
};

const isBlock = (node: RootContent | undefined) => {
  return node?.type === 'element' && BLOCK_TAG_NAMES.includes(node.tagName.toLowerCase());
};

const getOffset = (
  root: HastRoot | Element,
  path: number[],
  offset: number,
  startIndex: number,
): number => {
  let parent = root;
  let result = offset;

  for (const index of path) {
    result += getLengthOfHast({ type: 'root', children: parent.children.slice(startIndex, index) });
    startIndex = 0;

    const child = parent.children[index];

    if (child?.type === 'element') {
      parent = child;
    }
  }

  return result;
};

/** Finds one inline suffix without crossing block siblings, a line break, or an opaque subtree. */
export const getTailRange = (root: HastRoot, length: number) => {
  const frames: TailFrame[] = [
    { parent: root, childIndex: root.children.length - 1, hasSuffix: false, hasTarget: false },
  ];
  const path: number[] = [];
  let first: TailText | null = null;
  let last: TailText | null = null;
  let remaining = length;

  while (frames.length > 0 && remaining > 0) {
    const frame = frames[frames.length - 1];

    if (!frame) {
      break;
    }

    if (frame.childIndex < 0) {
      const ancestor = frames[frames.length - 2];

      const parent = ancestor?.parent;

      if (
        frame.hasTarget &&
        parent?.type === 'element' &&
        BOUNDARY_TAG_NAMES.includes(parent.tagName.toLowerCase())
      ) {
        break;
      }

      if (ancestor && frame.hasSuffix) {
        ancestor.hasSuffix = true;
      }

      frames.pop();
      path.pop();
      continue;
    }

    const index = frame.childIndex;
    const node = frame.parent.children[index];
    frame.childIndex -= 1;

    if (frame.hasSuffix && (isBlock(node) || isBlock(frame.parent.children[index + 1]))) {
      break;
    }

    if (node?.type === 'text') {
      if (node.value.length === 0) {
        if (!last) {
          return null;
        }

        continue;
      }

      if (!last && node.value.trim().length === 0 && /[\r\n]/.test(node.value)) {
        continue;
      }

      if (
        !last &&
        (isPatch(frame.parent.children[index - 1]) ||
          isPatch(frame.parent.children[index + 1]) ||
          frames.some(({ parent }) => parent.type === 'element' && isForbidden(parent)))
      ) {
        return null;
      }

      const units = [...getTextUnits(node.value)];
      let start = units.length;

      while (start > 0 && remaining > 0 && !units[start - 1]?.includes('\n')) {
        start -= 1;
        remaining -= 1;
      }

      if (start < units.length) {
        if (!last) {
          frames.forEach((entry) => {
            entry.hasTarget = true;
          });
        }

        frame.hasSuffix = true;
        first = { path: [...path, index], offset: start };
        last ??= { path: [...path, index], offset: units.length };
      }

      if (start > 0) {
        break;
      }

      continue;
    }

    if (node?.type !== 'element' || isHiddenTagName(node.tagName)) {
      continue;
    }

    if ((last && isForbidden(node)) || node.tagName.toLowerCase() === 'br') {
      break;
    }

    if (
      last &&
      node.children.length === 0 &&
      getLengthOfHast({ type: 'root', children: [node] }) > 0
    ) {
      break;
    }

    path.push(index);
    frames.push({
      parent: node,
      childIndex: node.children.length - 1,
      hasSuffix: false,
      hasTarget: false,
    });
  }

  if (!first || !last) {
    return null;
  }

  let depth = 0;
  let parent: HastRoot | Element = root;

  while (depth < first.path.length - 1 && first.path[depth] === last.path[depth]) {
    const child: RootContent | undefined = parent.children[first.path[depth] ?? -1];

    if (child?.type !== 'element') {
      break;
    }

    parent = child;
    depth += 1;
  }

  const startIndex = first.path[depth] ?? 0;
  const endIndex = (last.path[depth] ?? startIndex) + 1;
  return {
    path: first.path.slice(0, depth),
    startIndex,
    endIndex,
    start: getOffset(parent, first.path.slice(depth), first.offset, startIndex),
    end: getOffset(parent, last.path.slice(depth), last.offset, startIndex),
  };
};
