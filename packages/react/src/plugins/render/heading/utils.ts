import type { Element, ElementContent } from 'hast';

import { toNumber } from 'lodash-es';

import { HEADING_LEVELS } from './consts';

export const isHeadingNode = (node: ElementContent): node is Element =>
  node.type === 'element' &&
  node.tagName.length === 2 &&
  node.tagName.startsWith('h') &&
  HEADING_LEVELS.includes(node.tagName[1] ?? '');

export const getHeadingLevel = (tagName: string): number => toNumber(tagName[1]);
