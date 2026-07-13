import type { Parent } from 'mdast';

import { isArray } from 'lodash-es';

export const isMdastParent = (value: unknown): value is Parent => {
  return isArray((value as { children?: unknown } | null)?.children);
};
