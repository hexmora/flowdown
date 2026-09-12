import type { Element, ElementContent } from 'hast';

import { SHAD_DATA_ATTR, SHAD_HOST_VALUE, SHAD_TAG_NAME } from '@fluxdown/core-presets/mapper';

import { isElementWithTag } from '../../base';

export const isShadNode = (node: ElementContent): node is Element => {
  return (
    isElementWithTag(node, SHAD_TAG_NAME) && node.properties[SHAD_DATA_ATTR] === SHAD_HOST_VALUE
  );
};
