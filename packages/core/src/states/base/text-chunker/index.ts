import { once, useCombineMap, useMap } from 'functive';
import { isEqual } from 'lodash-es';

import type { TextChunkerInputs } from './type';

import { buildBlockSections, chunkTextOfMarkdown } from './utils';

export * from './type';

export const TextChunker = /*#__PURE__*/ once(function TextChunker({
  patches,
  text,
}: TextChunkerInputs) {
  const texts = useMap(text, chunkTextOfMarkdown);

  return useCombineMap([texts, patches], buildBlockSections, isEqual);
});
