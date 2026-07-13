import type { Element, Node, Parent, Text } from 'hast';

import { isArray, isString, isUndefined } from 'lodash-es';

export const isHastParent = (node: Node): node is Parent => isArray((node as Parent).children);

export const isHastElement = (node?: Node, tagName?: string): node is Element =>
  Boolean(node) &&
  (node as Element).type === 'element' &&
  (isUndefined(tagName) || tagName === (node as Element).tagName);

export const isHastLeafElement = (node: Node): node is Element => {
  return isHastElement(node) && node.children.length === 0;
};

export const isHastText = (node: Node): node is Text => {
  return (node as Text).type === 'text' && isString((node as Text).value);
};
