import { isEqual } from 'lodash-es';
import { once, S, useMap, useMapEach } from 'reactive';

import type { BlockCompilerInputs, BlockCompilerItem, IBlockCompiler } from './type';

import { CompiledBlock } from './states';

export * from './states';
export * from './type';

export const BlockCompiler = /*#__PURE__*/ once(
  ({ sections, config, getRemarks, getRehypes }: BlockCompilerInputs): IBlockCompiler => {
    let nextKey = 0;

    const items = useMap(sections, (currentSections) => {
      let charStart = 0;

      return currentSections.map((section, currentIndex): BlockCompilerItem => {
        const charEnd = charStart + section.text.length;

        const item = {
          section,
          meta: { charStart, charEnd, currentIndex, blockCount: currentSections.length },
        };

        charStart = charEnd;

        return item;
      });
    });

    return useMapEach(
      items,
      (item) =>
        S([CompiledBlock, { item, key: String(++nextKey), config, getRemarks, getRehypes }]),
      isEqual,
    );
  },
);
