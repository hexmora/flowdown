import { once, S, useCombineMap, useCreate, useMap } from 'functive';
import { isEqual } from 'lodash-es';

import type { BlockRemarksConfig } from '../../type';
import type { CompiledBlockInputs } from './type';

import { BlockItem } from '../../../block-item';
import { markdownToHast } from '../../utils';

export * from './type';

export const CompiledBlock = /*#__PURE__*/ once(
  ({ item, key, config, getRemarks, getRehypes }: CompiledBlockInputs) => {
    const section = useMap(item, (currentItem) => currentItem.section, isEqual);

    const meta = useMap(
      item,
      (currentItem) => ({ ...currentItem.meta, key, sourceText: currentItem.section.text }),
      isEqual,
    );

    const remarksConfig = useCombineMap(
      [config, item],
      ([
        { repairEnding, ...restConfig },
        {
          section: { patches },
          meta: { currentIndex, blockCount },
        },
      ]): BlockRemarksConfig => ({
        ...restConfig,
        repairEnding: repairEnding && currentIndex === blockCount - 1,
        patches,
      }),
      isEqual,
    );

    const remarks = getRemarks({ config: remarksConfig });

    // Keep the factory per block so it can accept block-specific inputs in the future.
    const rehypes = getRehypes();

    const source = useCombineMap(
      [section, remarks, rehypes],
      ([{ text }, currentRemarks, currentRehypes]) =>
        markdownToHast({ text, remarks: currentRemarks, rehypes: currentRehypes }),
      isEqual,
    );

    const block = useCreate(S([BlockItem, { source, meta }]));

    // Emit the block instance while keeping compilation active.
    return useMap(source, () => block);
  },
);
