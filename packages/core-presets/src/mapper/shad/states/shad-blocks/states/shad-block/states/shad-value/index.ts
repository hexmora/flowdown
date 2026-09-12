import { once, useClearable, useCombineMap } from 'functive';

import type { ShadValueInputs } from './type';

import { createShadRoot } from '../../../../../../utils';

export const ShadValue = /*#__PURE__*/ once(function ShadValue({
  source,
  current,
  tail,
  progress,
}: ShadValueInputs) {
  // Reapply the preceding mapper with this fork's range and keep its inputs alive independently.
  const previous = useClearable(source.fork({ range: current.range, meta: current.meta }));

  return useCombineMap([previous.value, tail, progress], ([root, lastBlock, position]) =>
    source === lastBlock && position.length > 0 ? createShadRoot(root, position) : root,
  );
});
