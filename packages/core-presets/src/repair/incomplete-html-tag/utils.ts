import { nth } from 'lodash-es';

const isAsciiLetter = (value: string | undefined): boolean => {
  return value !== undefined && ((value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z'));
};

const isAsciiDigit = (value: string | undefined): boolean => {
  return value !== undefined && value >= '0' && value <= '9';
};

const isTagNameCharacter = (value: string | undefined): boolean => {
  return isAsciiLetter(value) || isAsciiDigit(value) || value === '-' || value === ':';
};

const isPotentialTag = (value: string): boolean => {
  if (value === '<') {
    return true;
  }

  let index = 1;

  if (nth(value, index) === '/') {
    index += 1;

    if (index === value.length) {
      return true;
    }
  }

  if (!isAsciiLetter(nth(value, index))) {
    return false;
  }

  index += 1;

  while (isTagNameCharacter(nth(value, index))) {
    index += 1;
  }

  if (index === value.length) {
    return true;
  }

  const delimiter = nth(value, index);

  return delimiter === '/' || delimiter === '>' || /\s/.test(delimiter ?? '');
};

const hasUnquotedClosingBracket = (value: string): boolean => {
  let quote: '"' | "'" | undefined;

  for (let index = 1; index < value.length; index += 1) {
    const character = nth(value, index);

    if (quote) {
      if (character === quote) {
        quote = undefined;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;

      continue;
    }

    if (character === '>') {
      return true;
    }
  }

  return false;
};

export const getIncompleteTagStart = (value: string): number | undefined => {
  const start = value.lastIndexOf('<');

  if (start === -1) {
    return undefined;
  }

  const suffix = value.slice(start);

  if (!isPotentialTag(suffix) || hasUnquotedClosingBracket(suffix)) {
    return undefined;
  }

  return start;
};
