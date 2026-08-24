import type { ReactRenderMatchParams } from '../base/type';
import type { TexMode } from './type';

import { getTextContent } from '../base/utils';

export const getTexMode = ({ node }: ReactRenderMatchParams): TexMode | null => {
  if (node.type !== 'element' || node.tagName !== 'span') {
    return null;
  }

  const dataType = node.properties?.dataType;

  if (dataType === 'inline-math') {
    return 'inline';
  }

  if (dataType === 'block-math') {
    return 'display';
  }

  return null;
};

export const getTex = ({ node }: ReactRenderMatchParams) => {
  if (getTexMode({ node, parents: [] }) === null) {
    return null;
  }

  const tex = getTextContent(node).trim();

  return tex || null;
};
