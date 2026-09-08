import { once, useSwitchMap } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { BlockLengthsInputs } from './type';

export * from './type';

export const BlockLengths = /*#__PURE__*/ once(function BlockLengths<T>({
  source,
}: BlockLengthsInputs<T>) {
  return useSwitchMap(source, (blocks) => blocks.map((block) => block.baseLength), shallowEqual);
});
