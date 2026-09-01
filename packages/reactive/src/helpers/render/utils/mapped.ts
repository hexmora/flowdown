import type { Observer, Subscription } from 'rxjs';

import { isNaN, max } from 'lodash-es';

import type { Distinctor, IReactiveState } from '../../../modules/reactive-state';
import type { IStateClosure } from '../../../modules/state-closure';
import type {
  FunctionalStateClosureResultResolver,
  StateClosureHookResolvedSource,
  StateClosureHookSourceResolver,
} from '../../hooks/runtime';

import { BatchScheduler } from '../../../modules/batch-scheduler';
import { Destructible } from '../../../modules/destructible';
import { ReactiveState } from '../../../modules/reactive-state';
import { assert } from '../../../utils';
import { StateClosureHookRuntime } from '../../hooks/runtime';
import { combineMapState } from '../../operator';

type MappedStateSources = [] | [IReactiveState<unknown>, ...IReactiveState<unknown>[]];

const getCombinedPriority = (...priorities: number[]) => {
  return priorities.some(isNaN) ? NaN : (max(priorities) ?? 0);
};

class ComposedStateController<T> extends Destructible {
  private active = false;

  private currentCleanup: (() => void) | undefined;

  private currentSource: unknown;

  private currentState: IReactiveState<T>;

  private currentSubscription: Subscription | null = null;

  private innerCompleted = false;

  private observer: Observer<T> | null = null;

  private outerCompleted = false;

  private renderedSubscription: Subscription | null = null;

  readonly initial: T;

  constructor(
    private readonly rendered: IReactiveState<unknown>,
    private readonly resolveSource: FunctionalStateClosureResultResolver,
    private readonly onSourceChange: (state: IReactiveState<T>) => void,
    private readonly onRenderedComplete: () => void,
    private readonly onError: (error: unknown) => void,
  ) {
    super();

    this.currentSource = rendered.value;

    const resolution = this.resolveCurrentSource(this.currentSource);

    this.currentState = resolution.state;

    this.currentCleanup = resolution.cleanup;

    this.initial = this.currentState.value;
  }

  get priority() {
    return BatchScheduler.getPriority(this.currentState);
  }

  private resolveCurrentSource(source: unknown): StateClosureHookResolvedSource<T> {
    return this.resolveSource<T>(source);
  }

  private releaseCurrentSource() {
    this.currentSubscription?.unsubscribe();

    this.currentSubscription = null;

    this.currentCleanup?.();

    this.currentCleanup = undefined;
  }

  private finishIfCompleted() {
    if (this.outerCompleted && this.innerCompleted) {
      this.observer?.complete();
    }
  }

  private subscribeCurrentSource(pushCurrent: boolean) {
    if (!this.active) {
      return;
    }

    const currentState = this.currentState;

    this.innerCompleted = currentState.closed;

    if (pushCurrent) {
      this.observer?.next(currentState.value);
    }

    if (this.innerCompleted) {
      this.finishIfCompleted();

      return;
    }

    this.currentSubscription = currentState.subscribe({
      next: (value) => this.observer?.next(value),
      error: (error) => {
        this.onError(error);

        this.observer?.error(error);
      },
      complete: () => {
        this.innerCompleted = true;

        this.finishIfCompleted();
      },
    });
  }

  private switchSource(source: unknown) {
    if (Object.is(this.currentSource, source)) {
      return;
    }

    const resolution = this.resolveCurrentSource(source);

    try {
      void resolution.state.value;
    } catch (error) {
      resolution.cleanup?.();

      throw error;
    }

    this.releaseCurrentSource();

    this.currentSource = source;

    this.currentState = resolution.state;

    this.currentCleanup = resolution.cleanup;

    this.onSourceChange(this.currentState);

    this.subscribeCurrentSource(true);
  }

  private stop() {
    if (!this.active) {
      return;
    }

    this.active = false;

    this.renderedSubscription?.unsubscribe();

    this.renderedSubscription = null;

    this.releaseCurrentSource();

    this.observer = null;
  }

  start(observer: Observer<T>) {
    assert(!this.active, 'A composed state source can only be observed once.');

    this.active = true;

    this.observer = observer;

    this.subscribeCurrentSource(false);

    let initialEmission = true;

    this.renderedSubscription = this.rendered.subscribe({
      next: (source) => {
        if (initialEmission) {
          initialEmission = false;

          if (Object.is(this.currentSource, source)) {
            return;
          }
        }

        try {
          this.switchSource(source);
        } catch (error) {
          this.onError(error);

          observer.error(error);
        }
      },
      error: (error) => {
        this.onError(error);

        observer.error(error);
      },
      complete: () => {
        this.outerCompleted = true;

        this.onRenderedComplete();

        this.finishIfCompleted();
      },
    });

    return () => this.stop();
  }

  override destroy() {
    this.stop();

    this.releaseCurrentSource();

    super.destroy();
  }
}

/** Keeps functional descriptor nodes lazy while owning their hook graph. */
export class MappedStateClosure<T> extends Destructible implements IStateClosure<T> {
  private _value: IReactiveState<T> | null = null;

  private readonly hooks: StateClosureHookRuntime;

  private readonly read: () => unknown;

  private readonly resolveResult: FunctionalStateClosureResultResolver;

  private readonly sources: MappedStateSources;

  private readonly distinctor: Distinctor<T>;

  constructor(
    read: () => unknown,
    sources: MappedStateSources,
    resolveResult: FunctionalStateClosureResultResolver,
    resolveHookSource: StateClosureHookSourceResolver,
    distinctor: Distinctor<T> = Object.is,
  ) {
    super();

    this.read = read;

    this.sources = sources;

    this.distinctor = distinctor;

    this.resolveResult = resolveResult;

    this.hooks = new StateClosureHookRuntime(resolveHookSource);
  }

  private setup() {
    if (this._value !== null) {
      return this._value;
    }

    assert(!this.destroyed, 'Cannot set up a destroyed state closure.');

    const initialSource = this.hooks.render(this.read);

    let useInitialSource = true;

    const read = () => {
      if (useInitialSource) {
        useInitialSource = false;

        return initialSource;
      }

      return this.hooks.render(this.read);
    };

    let rendered: ReactiveState<unknown> | null = null;

    let controller: ComposedStateController<T> | null = null;

    let value: ReactiveState<T> | null = null;

    try {
      rendered =
        this.sources.length > 0
          ? combineMapState(
              this.sources as [IReactiveState<unknown>, ...IReactiveState<unknown>[]],
              read,
              Object.is,
            )
          : ReactiveState.of(read());

      controller = new ComposedStateController(
        rendered,
        this.resolveResult,
        (state) => {
          if (!value) {
            return;
          }

          const priority = getCombinedPriority(
            BatchScheduler.getPriority(rendered),
            BatchScheduler.getPriority(state),
          );

          BatchScheduler.setPriority(value, priority + 1);
        },
        () => this.hooks.complete(),
        (error) => this.hooks.error(error),
      );

      value = new ReactiveState({
        initial: controller.initial,
        emitter: (observer) => controller?.start(observer),
        distinctor: this.distinctor,
      });

      const priority = getCombinedPriority(
        BatchScheduler.getPriority(rendered),
        controller.priority,
      );

      BatchScheduler.setPriority(value, priority + 1);

      this._value = this.clearable(value);

      this.clearable(controller);

      this.clearable(rendered);

      return this._value;
    } catch (error) {
      value?.destroy();

      controller?.destroy();

      rendered?.destroy();

      throw error;
    }
  }

  get value(): IReactiveState<T> {
    return this.setup();
  }

  override destroy() {
    if (this.destroyed) {
      return;
    }

    super.destroy();

    this.hooks.destroy();
  }
}
