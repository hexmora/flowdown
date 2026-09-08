import type { Parent } from 'mdast';

import { last, nth } from 'lodash-es';

import { COMPLETE_FOOTNOTE_REFERENCE, INCOMPLETE_FOOTNOTE_REFERENCE } from './consts';

export const removeCompleteReferences = (value: string): string => {
  return value.replace(COMPLETE_FOOTNOTE_REFERENCE, (match, offset: number) => {
    return isEscaped(value, offset) ? match : '';
  });
};

export const removeIncompleteReference = (value: string): string => {
  const match = INCOMPLETE_FOOTNOTE_REFERENCE.exec(value);

  if (!match || match.index === undefined || isEscaped(value, match.index)) {
    return value;
  }

  return value.slice(0, match.index);
};

export const isStructuralTail = (node: unknown, parents: Parent[]): boolean => {
  let child = node;

  for (const parent of parents) {
    if (last(parent.children) !== child) {
      return false;
    }

    child = parent;
  }

  return true;
};

const isEscaped = (value: string, offset: number): boolean => {
  let precedingEscapes = 0;

  for (let index = offset - 1; index >= 0 && nth(value, index) === '\\'; index -= 1) {
    precedingEscapes += 1;
  }

  return precedingEscapes % 2 === 1;
};
