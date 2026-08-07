import { BaseStateClosure } from '@flowdown/reactive';
import { isEqual } from 'lodash-es';

import type { IBlockSection, TextChunkerStateClosureParams } from './type';

import { chunkPatchesByTexts } from './patches';
import { chunkTextOfMarkdown } from './utils';

export * from './patches';
export * from './type';
export * from './utils';

export class TextChunkerStateClosure extends BaseStateClosure<IBlockSection[]> {
  constructor({ text, patches }: TextChunkerStateClosureParams) {
    super({
      source: () => {
        const texts = this.map(text, chunkTextOfMarkdown);

        return this.combineMap(
          [texts, patches],
          ([currentTexts, currentPatches]) => {
            const patchGroups = chunkPatchesByTexts(currentPatches, currentTexts);

            return currentTexts.map((currentText, index) => ({
              text: currentText,
              patches: patchGroups[index] ?? [],
            }));
          },
          isEqual,
        );
      },
    });
  }
}
