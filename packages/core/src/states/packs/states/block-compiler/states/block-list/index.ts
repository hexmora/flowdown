import { BaseStateClosure, mapState, MutableState } from '@flowdown/reactive';
import { assert } from '@flowdown/utils';
import { isEqual, isNil } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { HastRoot } from '../../../../../../typings';
import type { IBlockMeta, IBlockSection, IBlockState } from '../../../../../base';
import type { BlockListItemContext, BlockListStateClosureParams } from './type';

import { BlockStateClosure } from './states';
import { destroyAll } from './utils';

export * from './states';
export * from './type';

type BlockClosure = {
  context: MutableState<BlockListItemContext>;

  destroy(): void;

  state: BlockStateClosure;
};

type CreateBlockClosure = (params: {
  charStart: number;
  count: number;
  index: number;
  section: IBlockSection;
}) => BlockClosure;

export class BlockListStateClosure extends BaseStateClosure<
  IBlockState<HastRoot>[],
  BlockListStateClosureParams
> {
  private closures: BlockClosure[] = [];

  private prevKeyIndex: number | null = null;

  protected render() {
    const { createSource, sections } = this.inputs;

    const createClosure: CreateBlockClosure = ({ charStart, count, index, section }) => {
      const blockKey = this.createKey();

      const context = new MutableState<BlockListItemContext>({
        initial: {
          meta: {
            charStart,
            charEnd: charStart + section.text.length,
            currentIndex: index,
            blockCount: count,
          },
          section,
        },
        distinctor: isEqual,
      });

      const meta = mapState(
        context,
        ({ meta: currentMeta, section: currentSection }): IBlockMeta => ({
          ...currentMeta,
          key: blockKey,
          sourceText: currentSection.text,
        }),
        isEqual,
      );

      try {
        const source = createSource(context);

        const state = new BlockStateClosure({ source, meta });

        return {
          context,
          state,
          destroy: () => {
            destroyAll([state, meta, context]);
          },
        };
      } catch (error) {
        destroyAll([meta, context]);

        throw error;
      }
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
    sections: BlockListStateClosureParams['sections'],
    createClosure: CreateBlockClosure,
  ) {
    return this.map(sections, (currentSections, prev): BlockClosure[] => {
      const currentCount = currentSections.length;

      const [prevSections, prevClosures]: [IBlockSection[], BlockClosure[]] = prev ?? [[], []];

      assert(
        prevSections.length === prevClosures.length,
        'Previous sections and closures must have the same length.',
      );

      let nextCharStart = 0;

      const nextParams = currentSections.map((section, index) => {
        const charStart = nextCharStart;

        nextCharStart += section.text.length;

        return {
          charStart,
          count: currentCount,
          index,
          section,
        };
      });

      const retainedClosures = prevClosures.slice(0, currentCount);

      const createdClosures: BlockClosure[] = [];

      const prevKeyIndex = this.prevKeyIndex;

      try {
        for (const params of nextParams.slice(prevClosures.length)) {
          createdClosures.push(createClosure(params));
        }
      } catch (error) {
        destroyAll(createdClosures);

        this.prevKeyIndex = prevKeyIndex;

        throw error;
      }

      for (const [index, closure] of retainedClosures.entries()) {
        const params = nextParams[index];

        assert(params);

        const { charStart, count, section } = params;

        closure.context.next({
          meta: {
            charStart,
            charEnd: charStart + section.text.length,
            currentIndex: index,
            blockCount: count,
          },
          section,
        });
      }

      const nextClosures = [...retainedClosures, ...createdClosures];

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
