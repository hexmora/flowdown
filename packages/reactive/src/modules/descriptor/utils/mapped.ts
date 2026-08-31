import { assert, Destructible } from '@flowdown/utils';
import { isEqual } from 'lodash-es';

import type { Distinctor, IReactiveState } from '../../reactive-state';
import type { IStateClosure } from '../../state-closure';

import { BatchScheduler } from '../../batch-scheduler';
import { combineMapState, ReactiveState } from '../../reactive-state';

type MappedStateSources = [] | [IReactiveState<unknown>, ...IReactiveState<unknown>[]];

/** Keeps mapped descriptor nodes lazy while breaking the state-closure/descriptor runtime cycle. */
export class MappedStateClosure<T> extends Destructible implements IStateClosure<T> {
  private _value: IReactiveState<T> | null = null;

  private readonly read: () => T;

  private readonly sources: MappedStateSources;

  private readonly distinctor: Distinctor<T>;

  constructor(read: () => T, sources: MappedStateSources, distinctor: Distinctor<T> = isEqual) {
    super();

    this.read = read;

    this.sources = sources;

    this.distinctor = distinctor;
  }

  private setup() {
    if (this._value !== null) {
      return this._value;
    }

    assert(!this.destroyed, 'Cannot set up a destroyed state closure.');

    const value =
      this.sources.length > 0
        ? combineMapState(
            this.sources as [IReactiveState<unknown>, ...IReactiveState<unknown>[]],
            this.read,
            this.distinctor,
          )
        : ReactiveState.of(this.read());

    this._value = this.clearable(value);

    BatchScheduler.setPriority(this._value, BatchScheduler.getPriority(this._value) + 1);

    return this._value;
  }

  get value(): IReactiveState<T> {
    return this.setup();
  }
}
