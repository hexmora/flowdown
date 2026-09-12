import type { Element, RootContent } from 'hast';

import { SHAD_DATA_ATTR, SHAD_HOST_VALUE } from '@fluxdown/core-presets/mapper';
import { assert } from '@fluxdown/utils';

import type { HastRoot } from '../../typings';

import { collectText } from '../smooth/utils';

export const findHost = (node: HastRoot | RootContent): Element | undefined => {
  if (node.type === 'element' && node.properties[SHAD_DATA_ATTR] === SHAD_HOST_VALUE) {
    return node;
  }

  if ('children' in node) {
    for (const child of node.children) {
      const host = findHost(child);

      if (host) {
        return host;
      }
    }
  }

  return undefined;
};

export const readParts = (root: HastRoot) => {
  const host = findHost(root);

  if (!host) {
    return undefined;
  }

  const [leading, active] = host.children;

  assert(leading && active);

  return { leading: collectText(leading), active: collectText(active) };
};
