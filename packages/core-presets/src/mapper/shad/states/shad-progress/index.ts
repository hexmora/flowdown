import { last, sumBy } from 'lodash-es';
import {
  BatchScheduler,
  once,
  ReactiveState,
  useClearable,
  useCombineMap,
  useSwitchMap,
} from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { ShadInputs } from '../../type';
import type { ShadPosition } from './type';

import { SHAD_AUTO_HIDE_TIMEOUT } from './consts';

export * from './type';

export const ShadProgress = /*#__PURE__*/ once(function ShadProgress({
  source,
  enabled: enabledSource,
  length: lengthSource,
}: ShadInputs) {
  const tailLength = useSwitchMap(source, (blocks) => last(blocks)?.length ?? ReactiveState.of(0));

  const visibleLength = useCombineMap([source, tailLength], ([blocks]) =>
    sumBy(blocks, (block) => block.length.value),
  );

  const configuration = useCombineMap(
    [visibleLength, enabledSource, lengthSource],
    ([total, enabled, length]) => ({
      total,
      length: enabled && Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0,
    }),
    shallowEqual,
  );

  const input = configuration.value;

  const state = useClearable(
    new ReactiveState<ShadPosition>({
      initial: { length: input.value.length, activeLength: 0 },
      distinctor: shallowEqual,

      emitter: (observer) => {
        let maximum = input.value.total;

        let committed = maximum;

        let timeout: ReturnType<typeof setTimeout> | null = null;

        const clearTimeoutHandle = () => {
          if (timeout !== null) {
            clearTimeout(timeout);

            timeout = null;
          }
        };

        const publish = () => {
          const { total, length } = input.value;

          if (timeout === null || length <= 0) {
            committed = total;
          }

          observer.next({
            length,
            activeLength: timeout === null ? 0 : Math.min(length, Math.max(0, total - committed)),
          });

          if (input.closed && timeout === null) {
            observer.complete();
          }
        };

        const subscription = input.subscribe({
          next: ({ total }) => {
            if (total > maximum) {
              clearTimeoutHandle();

              timeout = setTimeout(() => {
                timeout = null;

                publish();
              }, SHAD_AUTO_HIDE_TIMEOUT);
            }

            maximum = total <= 0 ? 0 : Math.max(maximum, total);

            publish();
          },

          complete: publish,

          error: (error) => observer.error(error),
        });

        return () => {
          clearTimeoutHandle();

          subscription.unsubscribe();
        };
      },
    }),
  );

  BatchScheduler.setPriority(state, () => BatchScheduler.getPriority(input) + 1);

  return state;
});
