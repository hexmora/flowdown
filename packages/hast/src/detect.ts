import type { Element, Node } from 'hast';

import { isUndefined } from 'lodash-es';

export const isHastElement = (node?: Node, tagName?: string): node is Element =>
  Boolean(node) &&
  (node as Element).type === 'element' &&
  (isUndefined(tagName) || tagName === (node as Element).tagName);
