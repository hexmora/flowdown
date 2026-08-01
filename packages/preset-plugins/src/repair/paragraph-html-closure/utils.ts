import type { Paragraph, Parent, PhrasingContent } from 'mdast';

import { first, last, nth } from 'lodash-es';

import type { OpenHtmlTag, ParsedHtmlTag } from './type';

import { VOID_ELEMENTS } from './consts';

const isAsciiLetter = (value: string | undefined): boolean => {
  return value !== undefined && ((value >= 'a' && value <= 'z') || (value >= 'A' && value <= 'Z'));
};

const isAsciiDigit = (value: string | undefined): boolean => {
  return value !== undefined && value >= '0' && value <= '9';
};

const isTagNameCharacter = (value: string | undefined): boolean => {
  return isAsciiLetter(value) || isAsciiDigit(value) || value === '-' || value === ':';
};

const findClosingBracket = (value: string, start: number): number | undefined => {
  let quote: '"' | "'" | undefined;

  for (let index = start; index < value.length; index += 1) {
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
      return index;
    }
  }

  return undefined;
};

const parseHtmlTag = (value: string): ParsedHtmlTag | undefined => {
  const source = value.trim();

  if (first(source) !== '<') {
    return undefined;
  }

  let index = 1;
  const closing = nth(source, index) === '/';

  if (closing) {
    index += 1;
  }

  if (!isAsciiLetter(nth(source, index))) {
    return undefined;
  }

  const nameStart = index;

  index += 1;

  while (isTagNameCharacter(nth(source, index))) {
    index += 1;
  }

  const name = source.slice(nameStart, index);
  const delimiter = nth(source, index);

  if (delimiter !== '>' && delimiter !== '/' && !/\s/.test(delimiter ?? '')) {
    return undefined;
  }

  if (closing) {
    while (/\s/.test(nth(source, index) ?? '')) {
      index += 1;
    }

    if (nth(source, index) !== '>' || index !== source.length - 1) {
      return undefined;
    }

    return {
      closing: true,
      name,
      normalizedName: name.toLowerCase(),
      selfClosing: false,
    };
  }

  const bracket = findClosingBracket(source, index);

  if (bracket === undefined || bracket !== source.length - 1) {
    return undefined;
  }

  let marker = bracket - 1;

  while (/\s/.test(nth(source, marker) ?? '')) {
    marker -= 1;
  }

  return {
    closing: false,
    name,
    normalizedName: name.toLowerCase(),
    selfClosing: nth(source, marker) === '/',
  };
};

export const isRightmostNode = (node: Paragraph, parents: Parent[]) => {
  let child: object = node;

  for (const parent of parents) {
    if (last(parent.children) !== child) {
      return false;
    }

    child = parent;
  }

  return true;
};

const closingNode = (tag: OpenHtmlTag): PhrasingContent => ({
  type: 'html',
  value: `</${tag.name}>`,
});

export const closeParagraphTags = (paragraph: Paragraph): void => {
  const stack: OpenHtmlTag[] = [];
  const positions = new Map<string, number[]>();
  const children: PhrasingContent[] = [];
  let changed = false;

  const pushOpeningTag = (tag: ParsedHtmlTag) => {
    const position = stack.length;

    stack.push({ name: tag.name, normalizedName: tag.normalizedName });

    const matchingPositions = positions.get(tag.normalizedName);

    if (matchingPositions) {
      matchingPositions.push(position);
    } else {
      positions.set(tag.normalizedName, [position]);
    }
  };

  const popThrough = (position: number) => {
    for (let index = stack.length - 1; index >= position; index -= 1) {
      const tag = nth(stack, index);

      if (!tag) {
        continue;
      }

      const matchingPositions = positions.get(tag.normalizedName);

      matchingPositions?.pop();

      if (matchingPositions?.length === 0) {
        positions.delete(tag.normalizedName);
      }
    }

    stack.length = position;
  };

  for (const child of paragraph.children) {
    if (child.type === 'html') {
      const tag = parseHtmlTag(child.value);

      if (tag && !tag.closing && !tag.selfClosing && !VOID_ELEMENTS.includes(tag.normalizedName)) {
        pushOpeningTag(tag);
      } else if (tag?.closing) {
        const position = last(positions.get(tag.normalizedName));

        if (position !== undefined) {
          for (let index = stack.length - 1; index > position; index -= 1) {
            const openTag = nth(stack, index);

            if (openTag) {
              children.push(closingNode(openTag));
              changed = true;
            }
          }

          popThrough(position);
        } else if (stack.length > 0) {
          for (let index = stack.length - 1; index >= 0; index -= 1) {
            const openTag = nth(stack, index);

            if (openTag) {
              children.push(closingNode(openTag));
              changed = true;
            }
          }

          stack.length = 0;
          positions.clear();
        }
      }
    }

    children.push(child);
  }

  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const openTag = nth(stack, index);

    if (openTag) {
      children.push(closingNode(openTag));
      changed = true;
    }
  }

  if (changed) {
    paragraph.children = children;
  }
};
