import type { IRangeState } from '@flowdown/types';

import { isEqual } from 'lodash-es';
import { D, once, useClearable, useCombineMap, useMap } from 'reactive';

import type { CutoffBlockInputs } from './type';

export * from './type';

export const CutoffBlock = /*#__PURE__*/ once(function CutoffBlock<T>({
  source,
  end,
  count,
}: CutoffBlockInputs<T>) {
  const meta = useCombineMap(
    [source.meta, count],
    ([current, blockCount]) => ({ ...current, blockCount }),
    isEqual,
  );

  const range = useMap(
    end,
    (offset): IRangeState | null => (offset === null ? null : { start: 0, end: offset }),
    isEqual,
  );

  const fork = useClearable(source.fork({ meta: meta.value, range: range.value }));

  return D(fork);
});
