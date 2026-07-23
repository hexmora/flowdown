import { assert, compute, Destructible } from '@flowdown/utils';
import { BehaviorSubject } from 'rxjs';

import type {
  Distinctor,
  IReactiveState,
  StateMapper,
  StateValue,
  StateValues,
} from '../reactive-state';
import type { BaseStateClosureParams, BaseStateClosureSource, IStateClosure } from './type';

import { BatchScheduler } from '../batch-scheduler';
import {
  combineMapState,
  combineState,
  isReactiveStateLike,
  mapState,
  type ReactiveState,
  toReactiveState,
} from '../reactive-state';
import { extractRawSource } from './utils';

export * from './type';

export class BaseStateClosure<T> extends Destructible implements IStateClosure<T> {
  private subject: BehaviorSubject<T> | null = null;

  private _value: IReactiveState<T> | null = null;

  private readonly closureSource: BaseStateClosureSource<T>;

  constructor({ source, lazy = true }: BaseStateClosureParams<T>) {
    super();

    this.closureSource = source;

    if (!lazy) {
      this.setup();
    }
  }

  private setup() {
    if (this._value !== null) {
      return this._value;
    }

    assert(!this.destroyed, 'Cannot set up a destroyed state closure.');

    const rawSource = extractRawSource(this.closureSource);

    const initial = compute(() => {
      if (isReactiveStateLike(rawSource)) {
        return rawSource.value;
      }

      return rawSource;
    });

    this.subject = new BehaviorSubject(initial);

    if (isReactiveStateLike(rawSource)) {
      this.clearable(rawSource.subscribe(this.subject));
    }

    this.clearable(this.subject);

    this._value = this.clearable(toReactiveState(this.subject));

    if (isReactiveStateLike(rawSource)) {
      BatchScheduler.setPriority(this._value, BatchScheduler.getPriority(rawSource) + 1);
    }

    return this._value;
  }

  get value(): IReactiveState<T> {
    return this.setup();
  }

  protected map<S, R>(
    source: S,
    mapper: StateMapper<StateValue<S>, R>,
    distinctor?: Distinctor<R>,
  ): ReactiveState<R> {
    return this.clearable(mapState(source, mapper, distinctor));
  }

  protected combineMap<const TSources extends [unknown, ...unknown[]], R>(
    sources: [...TSources],
    mapper: StateMapper<StateValues<TSources>, R>,
    distinctor?: Distinctor<R>,
  ): ReactiveState<R> {
    return this.clearable(combineMapState(sources, mapper, distinctor));
  }

  protected combine<const TSources extends [unknown, ...unknown[]]>(
    ...sources: TSources
  ): ReactiveState<StateValues<TSources>> {
    return this.clearable(combineState(...sources));
  }

  protected next(newValue: T) {
    this.setup();

    assert(this.subject);

    this.subject.next(newValue);
  }
}
