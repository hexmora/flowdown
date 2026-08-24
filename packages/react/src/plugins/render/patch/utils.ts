import type { ElementContent } from 'hast';

import { isString } from 'lodash-es';

import type { PatchElement } from './type';

import { PATCH_MARKER } from '../../../consts';

export const isPatchNode = (node: ElementContent): node is PatchElement =>
  node.type === 'element' &&
  node.tagName === 'span' &&
  node.properties?.dataParserPatch === PATCH_MARKER &&
  isString(node.properties.dataPatchKey);
