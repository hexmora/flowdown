import { noop } from 'lodash-es';

import type { IMutableState, MutableStateParams } from './type';

import { ReactiveState } from '../reactive-state';

export * from './type';

export class MutableState<T> extends ReactiveState<T> implements IMutableState<T> {
  static override of<T>(value: T): MutableState<T> {
    return new MutableState({
      initial: value,
    });
  }

  constructor({ emitter = noop, ...params }: MutableStateParams<T>) {
    super({
      ...params,
      emitter,
    });
  }

  next(value: T) {
    this._next(value);
  }

  error(error: unknown) {
    this._error(error);
  }

  complete() {
    this._complete();
  }

  toReadonly(): ReactiveState<T> {
    return this;
  }
}
