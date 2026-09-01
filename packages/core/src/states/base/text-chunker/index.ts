import { isEqual } from 'lodash-es';
import { immediate, useCombineMap, useCompose, useMap } from 'reactive';

import type { TextChunkerStateClosureInputs } from './type';

import { buildBlockSections, chunkTextOfMarkdown } from './utils';

export * from './type';

export const TextChunkerStateClosure = /*#__PURE__*/ immediate(function TextChunkerStateClosure({
  patches,
  text,
}: TextChunkerStateClosureInputs) {
  const textState = useCompose(text);

  const patchesState = useCompose(patches);

  const texts = useMap(textState, chunkTextOfMarkdown);

  return useCombineMap([texts, patchesState], buildBlockSections, isEqual);
});
