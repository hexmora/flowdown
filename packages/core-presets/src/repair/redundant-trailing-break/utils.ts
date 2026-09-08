import type { Parent } from 'mdast';

import { last } from 'lodash-es';

export const INLINE_PARENT_TYPES: string[] = [
  'delete',
  'emphasis',
  'link',
  'linkReference',
  'strong',
];

const TRAILING_LINE_ENDINGS = /[\r\n]+$/;

export const removeTrailingBreaks = (parent: Parent): void => {
  while (parent.children.length > 0) {
    const child = last(parent.children);

    if (!child) {
      return;
    }

    if (child.type === 'break') {
      parent.children.pop();
      continue;
    }

    if (child.type !== 'text') {
      return;
    }

    const value = child.value.replace(TRAILING_LINE_ENDINGS, '');

    if (value === child.value) {
      return;
    }

    if (value.length > 0) {
      child.value = value;
      return;
    }

    parent.children.pop();
  }
};
