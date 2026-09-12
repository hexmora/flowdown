import { BatchScheduler, once, ReactiveState, useClearable } from 'functive';

import type { CompletedInputs } from './type';

export * from './type';

export const Completed = /*#__PURE__*/ once(function Completed({ source }: CompletedInputs) {
  const input = source.value;

  const state = useClearable(
    new ReactiveState({
      initial: input.closed,

      emitter: (observer) =>
        input.subscribe({
          complete: () => {
            observer.next(true);

            observer.complete();
          },

          error: (error) => observer.error(error),
        }),
    }),
  );

  BatchScheduler.setPriority(state, () => BatchScheduler.getPriority(input) + 1);

  return state;
});
