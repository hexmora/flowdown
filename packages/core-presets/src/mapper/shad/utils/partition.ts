import type { Element, ElementContent, Root as HastRoot, RootContent } from 'hast';

import { getLengthOfHast, sliceHast } from '@fluxdown/utils';

/** Splits only the selected path and retains invisible nodes and untouched siblings. */
export const splitChildren = (
  children: RootContent[],
  offset: number,
): [RootContent[], RootContent[]] => {
  let remaining = offset;

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];

    if (!child) {
      continue;
    }

    const root: HastRoot = { type: 'root', children: [child] };
    const length = getLengthOfHast(root);

    if (length <= remaining) {
      remaining -= length;
      continue;
    }

    if (remaining <= 0) {
      return [children.slice(0, index), children.slice(index)];
    }

    let before: RootContent[];
    let after: RootContent[];

    if (child.type === 'element') {
      const parts = splitChildren(child.children, remaining);
      const clone = (part: RootContent[]): Element => ({
        ...child,
        children: part as ElementContent[],
      });

      before = [clone(parts[0])];
      after = [clone(parts[1])];
    } else {
      before = sliceHast(root, 0, remaining)?.children ?? [];
      after = sliceHast(root, remaining, length)?.children ?? [];
    }

    return [
      [...children.slice(0, index), ...before],
      [...after, ...children.slice(index + 1)],
    ];
  }

  return [children.slice(), []];
};
