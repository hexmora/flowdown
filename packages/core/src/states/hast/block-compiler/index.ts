import type { IReactiveState } from '@flowdown/reactive';
import type { IRehypePlugin } from '@flowdown/types';
import type { OmitWithType } from '@flowdown/utils';

import {
  BaseStateClosure,
  BatchScheduler,
  combineMapState,
  MutableState,
  toState,
} from '@flowdown/reactive';
import { assert } from '@flowdown/utils';
import { isEqual, isNil, zip } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { HastRoot } from '../../../typings';
import type { IBlockMeta, IBlockSection, IBlockState } from '../../base';
import type {
  BlockCompilerStateClosureParams,
  BlockRemarksConfig,
  IBlockCompilerStateClosure,
} from './type';

import { BlockStateClosure } from '../block';
import { destroyAll, markdownToHast } from './utils';

export * from './type';
export * from './utils';

type MutableBlockMeta = OmitWithType<IBlockMeta, 'sourceText' | 'key'>;

type BlockClosure = {
  destroy(): void;
  meta: MutableState<MutableBlockMeta>;
  section: MutableState<IBlockSection>;
  state: BlockStateClosure;
};

type CreateBlockClosure = (params: {
  charStart: number;
  count: number;
  index: number;
  section: IBlockSection;
}) => BlockClosure;

export class BlockCompilerStateClosure
  extends BaseStateClosure<IBlockState<HastRoot>[], BlockCompilerStateClosureParams>
  implements IBlockCompilerStateClosure
{
  private closures: BlockClosure[] = [];

  private rehypes: IReactiveState<IRehypePlugin[]> | null = null;

  private prevKeyIndex: number | null = null;

  protected render() {
    const { config, getRehypes, getRemarks, sections } = this.inputs;

    const createClosure: CreateBlockClosure = ({ charStart, count, index, section }) => {
      const blockKey = this.createKey();

      const sectionState = new MutableState({ initial: section, distinctor: isEqual });

      const metaState = new MutableState<MutableBlockMeta>({
        initial: {
          charStart,
          charEnd: charStart + section.text.length,
          currentIndex: index,
          blockCount: count,
        },
        distinctor: isEqual,
      });

      const remarksConfig = combineMapState(
        [config, sectionState, metaState],
        ([
          { repairEnding, ...restConfig },
          { patches },
          { currentIndex, blockCount },
        ]): BlockRemarksConfig => {
          return {
            ...restConfig,
            repairEnding: repairEnding && currentIndex === blockCount - 1,
            patches,
          };
        },
        isEqual,
      );

      const remarks = toState(getRemarks(remarksConfig));

      const rehypes = (this.rehypes ??= toState(getRehypes()));

      const source = combineMapState(
        [sectionState, remarks, rehypes],
        ([currentSection, currentRemarks, currentRehypes]) => {
          return markdownToHast({
            text: currentSection.text,
            remarks: currentRemarks,
            rehypes: currentRehypes,
          });
        },
        isEqual,
      );

      const meta = combineMapState(
        [metaState, sectionState],
        ([currentMeta, currentSection]): IBlockMeta => ({
          ...currentMeta,
          key: blockKey,
          sourceText: currentSection.text,
        }),
        isEqual,
      );

      const state = new BlockStateClosure({ source, meta });

      return {
        meta: metaState,
        section: sectionState,
        state,
        destroy: () => {
          destroyAll([state, meta, source, remarksConfig, metaState, sectionState]);
        },
      };
    };

    const closures = this.getClosuresState(sections, createClosure);

    const states = this.map(closures, (items) => items.map(({ state }) => state), shallowEqual);

    this.clearable(() => {
      destroyAll(this.closures);

      this.closures = [];
    });

    return states;
  }

  private getClosuresState(
    sections: BlockCompilerStateClosureParams['sections'],
    createClosure: CreateBlockClosure,
  ) {
    return this.map(sections, (currentSections, prev): BlockClosure[] => {
      const currentCount = currentSections.length;

      if (!prev) {
        let nextCharStart = 0;

        const initialClosures = currentSections.map((section, index) => {
          const charStart = nextCharStart;

          nextCharStart += section.text.length;

          return createClosure({
            charStart,
            count: currentCount,
            index,
            section,
          });
        });

        this.closures = initialClosures;

        return initialClosures;
      }

      const [prevSections, prevClosures] = prev;

      assert(
        prevSections.length === prevClosures.length,
        'Previous sections and closures must have the same length.',
      );

      let nextCharStart = 0;

      const nextClosures = zip(prevSections, prevClosures, currentSections)
        .map<BlockClosure | null>(([prevSection, prevClosure, currentSection], index) => {
          const charStart = nextCharStart;

          if (currentSection) {
            nextCharStart += currentSection.text.length;
          }

          if (!prevSection) {
            assert(currentSection);

            return createClosure({
              charStart,
              count: currentCount,
              index,
              section: currentSection,
            });
          }

          assert(prevClosure);

          if (!currentSection) {
            return null;
          }

          BatchScheduler.batch(() => {
            prevClosure.meta.next({
              charStart,
              charEnd: charStart + currentSection.text.length,
              currentIndex: index,
              blockCount: currentCount,
            });

            prevClosure.section.next(currentSection);
          });

          return prevClosure;
        })
        .filter((closure): closure is BlockClosure => Boolean(closure));

      destroyAll(prevClosures.slice(currentCount));

      this.closures = nextClosures;

      return nextClosures;
    });
  }

  private createKey() {
    const key = isNil(this.prevKeyIndex) ? 1 : this.prevKeyIndex + 1;

    this.prevKeyIndex = key;

    return String(key);
  }
}
