import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import type {
  Distinctor,
  EmitterFunction,
  IReactiveState,
  ReactiveStateParams,
  StateSubscriber,
} from './type';

import { BatchScheduler } from '../batch-scheduler';
import { Destructible } from '../destructible';
import { isFinalPendingType } from './utils';

export * from './type';

type PendingType = 'next' | 'complete' | 'error';

type PendingPayload = { value?: unknown; error?: unknown };

export class ReactiveState<T> extends Destructible implements IReactiveState<T> {
  private readonly subject: BehaviorSubject<T>;

  private readonly distinctor: Distinctor<T>;

  private subscription: Subscription | null = null;

  private readonly emitter?: EmitterFunction<T>;

  private isSetup = false;

  private pendingType: PendingType | null = null;

  private pendingPayload: PendingPayload | null = null;

  static of<T>(value: T): ReactiveState<T> {
    return new ReactiveState({
      initial: value,
    });
  }

  constructor({ initial, emitter, distinctor = Object.is, lazy = true }: ReactiveStateParams<T>) {
    super();

    this.distinctor = distinctor;

    this.subject = new BehaviorSubject(initial);

    if (emitter) {
      this.emitter = emitter;

      if (!lazy) {
        this.setup();
      }
    } else {
      this.subject.complete();
    }
  }

  private flushPendingUpdate() {
    const type = this.pendingType;

    const payload = this.pendingPayload;

    this.clearPendingValue();

    if (!type || this.actualClosed) {
      return;
    }

    const callNext = () => {
      if (payload && 'value' in payload) {
        const value = payload.value as T;

        if (!this.distinctor(this.subject.value, value)) {
          this.subject.next(value);
        }
      }
    };

    const callFinal = () => {
      if (type === 'error') {
        this.subject.error(payload?.error);
      } else {
        this.subject.complete();
      }
    };

    try {
      callNext();
    } finally {
      if (isFinalPendingType(type)) {
        try {
          callFinal();
        } finally {
          this.teardown();

          super.destroy();
        }
      }
    }
  }

  private setPendingValue(type: PendingType, payload?: unknown) {
    if (this.pendingType && isFinalPendingType(this.pendingType)) {
      return;
    }

    this.pendingPayload ??= {};

    if (type === 'next') {
      this.pendingPayload.value = payload;
    }

    if (type === 'error') {
      this.pendingPayload.error = payload;
    }

    this.pendingType = type;

    BatchScheduler.schedule(this.flushPendingUpdate.bind(this), this);
  }

  private clearPendingValue() {
    this.pendingType = null;

    this.pendingPayload = null;
  }

  private setup() {
    if (this.isSetup) {
      return;
    }

    this.isSetup = true;

    if (!this.emitter || this.subject.closed || this.subject.isStopped) {
      return;
    }

    const observable = new Observable(this.emitter);

    const subscription = observable.subscribe({
      next: this._next.bind(this),
      error: this._error.bind(this),
      complete: this._complete.bind(this),
    });

    if (!this.closed && !subscription.closed) {
      this.subscription = subscription;
    }
  }

  private get actualClosed() {
    return this.subject.closed || this.subject.isStopped;
  }

  private get rawClosed() {
    return isFinalPendingType(this.pendingType) || this.actualClosed;
  }

  private get rawValue() {
    if (this.pendingPayload && 'value' in this.pendingPayload) {
      return this.pendingPayload.value as T;
    }

    return this.subject.value;
  }

  get value() {
    this.setup();

    return this.rawValue;
  }

  get closed() {
    this.setup();

    return this.rawClosed;
  }

  subscribe(subscriber: StateSubscriber<T>): Subscription {
    this.setup();

    return this.subject.subscribe(subscriber);
  }

  protected _next(value: T) {
    this.setup();

    if (this.rawClosed) {
      return;
    }

    if (this.distinctor(this.rawValue, value)) {
      return;
    }

    this.setPendingValue('next', value);
  }

  protected _error(error: unknown) {
    this.setup();

    if (this.rawClosed) {
      return;
    }

    this.setPendingValue('error', error);
  }

  protected _complete() {
    this.setup();

    if (this.rawClosed) {
      return;
    }

    this.setPendingValue('complete');
  }

  private teardown() {
    if (this.subscription && !this.subscription.closed) {
      this.subscription.unsubscribe();
    }

    this.subscription = null;
  }

  override destroy() {
    if (this.destroyed) {
      return;
    }

    this.clearPendingValue();

    this.teardown();

    this.subject.complete();

    super.destroy();
  }
}
