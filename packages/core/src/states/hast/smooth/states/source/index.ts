import type { Subscription } from 'rxjs';

import { BaseStateClosure, BatchScheduler, ReactiveState } from '@flowdown/reactive';
import { max, sum } from 'lodash-es';
import { shallowEqual } from 'shallow-equal';

import type { HastRoot } from '../../../../../typings';
import type { IBlockState } from '../../../../base';
import type { SmoothSourceSnapshot, SmoothSourceStateClosureParams } from './type';

export * from './type';

const createSnapshot = (blocks: IBlockState<HastRoot>[]): SmoothSourceSnapshot => {
  const currentBlocks = [...blocks];

  const lengths = currentBlocks.map(({ baseLength }) => baseLength.value);

  return {
    blocks: currentBlocks,
    lengths,
    fullIndex: sum(lengths),
  };
};

const isSnapshotEqual = (left: SmoothSourceSnapshot, right: SmoothSourceSnapshot) => {
  return shallowEqual(left.blocks, right.blocks) && shallowEqual(left.lengths, right.lengths);
};

export class SmoothSourceStateClosure extends BaseStateClosure<
  SmoothSourceSnapshot,
  SmoothSourceStateClosureParams
> {
  protected render() {
    const { source } = this.inputs;

    let currentBlocks = source.value;

    let lengthSubscriptions: Subscription[] = [];

    const clearLengthSubscriptions = () => {
      for (const subscription of lengthSubscriptions) {
        subscription.unsubscribe();
      }

      lengthSubscriptions = [];
    };

    const state = new ReactiveState({
      initial: createSnapshot(currentBlocks),
      emitter: (observer) => {
        let binding = false;

        const publish = () => {
          observer.next(createSnapshot(currentBlocks));
        };

        const bindBlocks = (blocks: IBlockState<HastRoot>[]) => {
          clearLengthSubscriptions();

          currentBlocks = blocks;

          binding = true;

          lengthSubscriptions = currentBlocks.map(({ baseLength }) => {
            return baseLength.subscribe({
              next: () => {
                if (!binding) {
                  publish();
                }
              },
              error: (error) => observer.error(error),
            });
          });

          binding = false;

          const priorities = currentBlocks.map(({ baseLength }) => {
            return BatchScheduler.getPriority(baseLength);
          });

          BatchScheduler.setPriority(
            state,
            Math.max(BatchScheduler.getPriority(source), max(priorities) ?? 0) + 1,
          );

          publish();
        };

        bindBlocks(currentBlocks);

        let initialSourcePending = true;

        const subscription = source.subscribe({
          next: (blocks) => {
            if (initialSourcePending && blocks === currentBlocks) {
              return;
            }

            bindBlocks(blocks);
          },
          error: (error) => observer.error(error),
          complete: () => observer.complete(),
        });

        initialSourcePending = false;

        return () => {
          subscription.unsubscribe();

          clearLengthSubscriptions();
        };
      },
      distinctor: isSnapshotEqual,
    });

    return this.clearable(state);
  }
}
