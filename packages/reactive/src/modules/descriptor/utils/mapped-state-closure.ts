import { isEqual } from 'lodash-es';

import type { Distinctor, IReactiveState } from '../../reactive-state';

import { combineMapState, ReactiveState } from '../../reactive-state';
import { BaseStateClosure } from '../../state-closure';

type MappedStateSources = [] | [IReactiveState<unknown>, ...IReactiveState<unknown>[]];

export class MappedStateClosure<T> extends BaseStateClosure<T> {
  constructor(read: () => T, sources: MappedStateSources, distinctor: Distinctor<T> = isEqual) {
    super({
      source: () => {
        const state =
          sources.length > 0
            ? combineMapState(
                sources as [IReactiveState<unknown>, ...IReactiveState<unknown>[]],
                read,
                distinctor,
              )
            : ReactiveState.of(read());

        return this.clearable(state);
      },
    });
  }
}
