import { sum } from 'lodash-es';
import { once, S, useCombine, useCombineMap, useCreate } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { IScheduler } from '../../../../../../../externals';
import type { CursorPositionInputs, SmoothPosition } from './type';

import { Completed } from '../../../../../../atoms';

export * from './type';

export const CursorPosition = /*#__PURE__*/ once(function CursorPosition(
  inputs: CursorPositionInputs,
) {
  const { lengths, ticks } = inputs;

  const configuration = useCombine(lengths, inputs.enabled, inputs.ticker, inputs.scheduler);

  const completion = useCreate(S([Completed, { source: configuration }]));

  let index = sum(lengths.value.value);

  let scheduler: IScheduler | null = null;

  return useCombineMap(
    [configuration, ticks, completion],
    (current, previous): SmoothPosition => {
      if (previous && shallowEqual(current, previous[0])) {
        return previous[1];
      }

      const [[sizes, enabled, , Scheduler], frame, completed] = current;

      const total = sum(sizes);

      index = enabled ? Math.min(index, total) : total;

      if (!enabled) {
        scheduler = null;
      } else if (frame) {
        const [[previousSizes], previousFrame] = previous?.[0] ?? current;

        const previousTotal = sum(previousSizes);

        const previousScheduler = scheduler;

        if (!scheduler || scheduler.constructor !== Scheduler) {
          scheduler = new Scheduler();
        }

        if (scheduler !== previousScheduler || frame.ticker !== previousFrame?.ticker) {
          scheduler.start(frame.timestamp, index);

          scheduler.push(total - index);
        } else {
          if (total < previousTotal) {
            scheduler.reset(index);

            scheduler.push(total - index);
          } else if (total > previousTotal) {
            scheduler.push(total - previousTotal);
          }

          if (frame !== previousFrame) {
            index = Math.min(total, index + Math.max(0, scheduler.tick(frame.timestamp)));
          }
        }
      }

      if (completed && index === total) {
        ticks.destroy();
      }

      let charIndex = index;

      if (total > 0) {
        for (const [blockIndex, length] of sizes.entries()) {
          if (charIndex <= length) {
            return { blockIndex, charIndex };
          }

          charIndex -= length;
        }
      }

      return { blockIndex: -1, charIndex: 0 };
    },
    shallowEqual,
  );
});
