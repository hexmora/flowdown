import { BehaviorSubject } from 'rxjs';

import type { StateMapper, StateValue, StateValues } from '../../helpers/operator';
import type { Distinctor, IReactiveState, ReactiveState } from '../reactive-state';
import type { IStateClosure, StateClosureSource } from './type';

import {
  combineMapState,
  combineState,
  isReactiveStateLike,
  mapState,
  toReactiveState,
} from '../../helpers/operator';
import { assert } from '../../utils';
import { BatchScheduler } from '../batch-scheduler';
import { Destructible } from '../destructible';
import { isResolvedClosureSource, isResolvedImmediateSource, resolveSource } from './utils';

export * from './type';

export abstract class BaseStateClosure<T, TInputs = void>
  extends Destructible
  implements IStateClosure<T>
{
  private subject: BehaviorSubject<T> | null = null;

  private _value: IReactiveState<T> | null = null;

  readonly inputs: TInputs;

  constructor(inputs: TInputs) {
    super();

    this.inputs = inputs;
  }

  private setup() {
    if (this._value !== null) {
      return this._value;
    }

    assert(!this.destroyed, 'Cannot set up a destroyed state closure.');

    const resolvedSource = resolveSource(this.render());

    const ownedStateClosure =
      isResolvedClosureSource(resolvedSource) && resolvedSource.owned
        ? resolvedSource.source
        : null;

    try {
      const directSource = isResolvedClosureSource(resolvedSource)
        ? resolvedSource.source.value
        : resolvedSource.source;

      const reactiveSource =
        !isResolvedImmediateSource(resolvedSource) && isReactiveStateLike<T>(directSource)
          ? directSource
          : null;

      const initial = reactiveSource ? reactiveSource.value : (directSource as T);

      this.subject = new BehaviorSubject(initial);

      if (reactiveSource) {
        this.clearable(reactiveSource.subscribe(this.subject));
      }

      this.clearable(this.subject);

      this._value = this.clearable(toReactiveState(this.subject));

      if (reactiveSource) {
        BatchScheduler.setPriority(this._value, BatchScheduler.getPriority(reactiveSource) + 1);
      }

      if (ownedStateClosure) {
        this.clearable(ownedStateClosure);
      }

      return this._value;
    } catch (error) {
      ownedStateClosure?.destroy();

      throw error;
    }
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

  protected abstract render(): StateClosureSource<T>;
}
