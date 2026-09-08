import type { Element, Node, Parent, Text } from 'hast';

import { forOwn, isNumber, isObjectLike, isString } from 'lodash-es';

const BLOCKED_TAG_NAMES = [
  'base',
  'embed',
  'iframe',
  'link',
  'meta',
  'object',
  'script',
  'style',
  'svg',
];

const TAG_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

const camelToKebab = (value: string) =>
  value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);

const toDataOrAriaName = (name: string) => {
  if (name.startsWith('data') && name.length > 4 && /[A-Z]/.test(name[4] ?? '')) {
    return `data-${camelToKebab(name.slice(4)).replace(/^-/, '')}`;
  }

  if (name.startsWith('aria') && name.length > 4 && /[A-Z]/.test(name[4] ?? '')) {
    return `aria-${camelToKebab(name.slice(4)).replace(/^-/, '')}`;
  }

  return name;
};

const toStyleName = (name: string) => {
  if (name.startsWith('--')) {
    return name;
  }

  return name
    .trim()
    .replace(/^-ms-/, 'ms-')
    .replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
};

const splitStyleDeclarations = (style: string) => {
  const declarations: string[] = [];

  let current = '';

  let depth = 0;

  let quote: '"' | "'" | null = null;

  for (const character of style) {
    if (quote) {
      current += character;

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'") {
      current += character;

      quote = character;

      continue;
    }

    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth = Math.max(0, depth - 1);
    }

    if (character === ';' && depth === 0) {
      declarations.push(current);

      current = '';

      continue;
    }

    current += character;
  }

  declarations.push(current);

  return declarations;
};

export const styleStringToObject = (style: string): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const declaration of splitStyleDeclarations(style)) {
    const separator = declaration.indexOf(':');

    if (separator < 1) {
      continue;
    }

    const name = toStyleName(declaration.slice(0, separator));

    const value = declaration.slice(separator + 1).trim();

    if (name && value) {
      result[name] = value;
    }
  }

  return result;
};

const normalizeStyle = (style: unknown): Record<string, number | string> | undefined => {
  if (isString(style)) {
    return styleStringToObject(style);
  }

  if (!isObjectLike(style) || Array.isArray(style)) {
    return undefined;
  }

  const result: Record<string, number | string> = {};

  forOwn(style, (value, name) => {
    if (isNumber(value) || isString(value)) {
      result[toStyleName(name)] = value;
    }
  });

  return result;
};

export const getReactProps = (node?: Element): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  const properties = node?.properties;

  if (!properties) {
    return result;
  }

  forOwn(properties, (value, rawName) => {
    const lowerName = rawName.toLowerCase();

    if (
      lowerName.startsWith('on') ||
      lowerName === 'children' ||
      lowerName === 'dangerouslysetinnerhtml' ||
      lowerName === 'key' ||
      lowerName === 'ref'
    ) {
      return;
    }

    if (value === null || value === undefined) {
      return;
    }

    if (rawName === 'className' || rawName === 'class') {
      result.className = Array.isArray(value) ? value.join(' ') : value;

      return;
    }

    if (rawName === 'style') {
      const style = normalizeStyle(value);

      if (style) {
        result.style = style;
      }

      return;
    }

    const name = toDataOrAriaName(rawName);

    result[name] = Array.isArray(value) ? value.join(' ') : value;
  });

  return result;
};

export const isHastElement = (node: Node, tagName?: string): node is Element => {
  if (node.type !== 'element' || !('tagName' in node) || !isString(node.tagName)) {
    return false;
  }

  return tagName === undefined || node.tagName === tagName;
};

export const isHastParent = (node: Node): node is Parent => 'children' in node;

export const isHastText = (node: Node): node is Text => node.type === 'text';

export const isSafeTagName = (tagName: string) =>
  TAG_NAME_PATTERN.test(tagName) && !BLOCKED_TAG_NAMES.includes(tagName);
