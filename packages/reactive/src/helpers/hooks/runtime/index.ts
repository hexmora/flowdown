import { shallowEqual } from 'shallow-equal';

import type { DestructibleTarget } from '../../../modules/destructible';
import type { Distinctor, IReactiveState, ReactiveState } from '../../../modules/reactive-state';
import type { StateClosureSource } from '../../../modules/state-closure';
import type { StateMapper, StateValue, StateValues } from '../../operator';
import type { StateClosureRef } from '../type';
import type {
  ClearableHookSlot,
  CombinedHookSlot,
  ComposeHookSlot,
  HookFinal,
  HookSlot,
  MapHookSlot,
  StateClosureHookSourceResolver,
} from './type';

import { BatchScheduler } from '../../../modules/batch-scheduler';
import {
  canUpdateSourceBinding,
  createClearableSlot,
  createCombinedSlot,
  createComposeSlot,
  createMapSlot,
  createRefSlot,
  destroySlots,
  hookOrderError,
  isCurrentStateClosureHookRuntime,
  setCurrentStateClosureHookRuntime,
  updateSourceBinding,
} from './utils';

export * from './type';

export class StateClosureHookRuntime {
  private cursor = 0;

  private destroyed = false;

  private draftRollbacks: Array<() => void> | null = null;

  private draftSlots: HookSlot[] | null = null;

  private final: HookFinal | null = null;

  private initialized = false;

  private rendering = false;

  private readonly resolveSource: StateClosureHookSourceResolver;

  private slots: HookSlot[] = [];

  constructor(resolveSource: StateClosureHookSourceResolver) {
    this.resolveSource = resolveSource;
  }

  private assertRendering() {
    if (
      !this.rendering ||
      !isCurrentStateClosureHookRuntime(this) ||
      !this.draftRollbacks ||
      !this.draftSlots
    ) {
      throw new TypeError(
        'State closure hooks can only be called while rendering a functional state closure.',
      );
    }
  }

  private addDraftRollback(rollback: () => void) {
    this.assertRendering();

    this.draftRollbacks!.push(rollback);
  }

  private finalizeSlot(slot: HookSlot) {
    if (this.final?.type === 'complete') {
      slot.completeRawSources();
    }

    if (this.final?.type === 'error') {
      slot.errorRawSources(this.final.error);
    }
  }

  private useSlot<T extends HookSlot>(
    type: T['type'],
    create: () => T,
    update: (slot: T) => boolean,
  ): T {
    this.assertRendering();

    const index = this.cursor;

    this.cursor += 1;

    const current = this.slots[index];

    if (current && current.type !== type) {
      throw hookOrderError();
    }

    if (current && update(current as T)) {
      return current as T;
    }

    const slot = create();

    this.draftSlots![index] = slot;

    this.finalizeSlot(slot);

    return slot;
  }

  private rollbackDraft() {
    const draftSlots = this.draftSlots;

    const draftRollbacks = this.draftRollbacks;

    if (!draftSlots || !draftRollbacks) {
      return;
    }

    const created = draftSlots.filter((slot, index) => slot !== this.slots[index]);

    try {
      for (let index = draftRollbacks.length - 1; index >= 0; index--) {
        draftRollbacks[index]();
      }
    } finally {
      destroySlots(created);
    }
  }

  private commitDraft() {
    const draftSlots = this.draftSlots;

    if (!draftSlots) {
      return;
    }

    const previous = this.slots;

    const replaced = previous.filter((slot, index) => slot !== draftSlots[index]);

    this.slots = draftSlots;

    this.initialized = true;

    destroySlots(replaced);
  }

  map<S, R>(
    source: S,
    mapper: StateMapper<StateValue<S>, R>,
    distinctor?: Distinctor<R>,
  ): ReactiveState<R> {
    const slot = this.useSlot(
      'map',
      () => createMapSlot(source, mapper, distinctor),
      (current: MapHookSlot) => {
        if (!canUpdateSourceBinding(current.binding, source)) {
          return false;
        }

        const previousMapper = current.mapper.current;

        const previousDistinctor = current.distinctor.current;

        const previousRevision = current.revision.value;

        const previousSource =
          current.binding.kind === 'raw' ? current.binding.state.value : undefined;

        this.addDraftRollback(() => {
          current.mapper.current = previousMapper;

          current.distinctor.current = previousDistinctor;

          BatchScheduler.batch(() => {
            updateSourceBinding(current.binding, previousSource);

            current.revision.next(previousRevision);
          });
        });

        current.mapper.current = mapper as StateMapper<unknown, unknown>;

        current.distinctor.current = distinctor as Distinctor<unknown> | undefined;

        BatchScheduler.batch(() => {
          updateSourceBinding(current.binding, source);

          current.revision.next(current.revision.value + 1);
        });

        return true;
      },
    );

    return slot.value as ReactiveState<R>;
  }

  combineMap<const TSources extends [unknown, ...unknown[]], R>(
    sources: [...TSources],
    mapper: StateMapper<StateValues<TSources>, R>,
    distinctor?: Distinctor<R>,
  ): ReactiveState<R> {
    return this.useCombinedSlot('combineMap', sources, mapper, distinctor);
  }

  combine<const TSources extends [unknown, ...unknown[]]>(
    ...sources: TSources
  ): ReactiveState<StateValues<TSources>> {
    return this.useCombinedSlot<TSources, StateValues<TSources>>(
      'combine',
      sources,
      (values: StateValues<TSources>) => values,
      (left, right) => shallowEqual(left, right),
    );
  }

  private useCombinedSlot<const TSources extends [unknown, ...unknown[]], R>(
    type: 'combine' | 'combineMap',
    sources: [...TSources],
    mapper: StateMapper<StateValues<TSources>, R>,
    distinctor?: Distinctor<R>,
  ): ReactiveState<R> {
    const slot = this.useSlot(
      type,
      () => createCombinedSlot(type, sources, mapper, distinctor),
      (current: CombinedHookSlot) => {
        if (
          current.bindings.length !== sources.length ||
          !current.bindings.every((binding, index) =>
            canUpdateSourceBinding(binding, sources[index]),
          )
        ) {
          return false;
        }

        const previousMapper = current.mapper.current;

        const previousDistinctor = current.distinctor.current;

        const previousRevision = current.revision.value;

        const previousSources = current.bindings.map((binding) =>
          binding.kind === 'raw' ? binding.state.value : undefined,
        );

        this.addDraftRollback(() => {
          current.mapper.current = previousMapper;

          current.distinctor.current = previousDistinctor;

          BatchScheduler.batch(() => {
            for (let index = 0; index < current.bindings.length; index++) {
              updateSourceBinding(current.bindings[index], previousSources[index]);
            }

            current.revision.next(previousRevision);
          });
        });

        current.mapper.current = mapper as StateMapper<unknown[], unknown>;

        current.distinctor.current = distinctor as Distinctor<unknown> | undefined;

        BatchScheduler.batch(() => {
          for (let index = 0; index < current.bindings.length; index++) {
            updateSourceBinding(current.bindings[index], sources[index]);
          }

          current.revision.next(current.revision.value + 1);
        });

        return true;
      },
    );

    return slot.value as ReactiveState<R>;
  }

  compose<T>(source: StateClosureSource<T>): IReactiveState<T> {
    const slot = this.useSlot(
      'compose',
      () => createComposeSlot(source, this.resolveSource),
      (current: ComposeHookSlot) => Object.is(current.source, source),
    );

    return slot.value as IReactiveState<T>;
  }

  clearable<T extends DestructibleTarget>(target: T): T {
    const slot = this.useSlot(
      'clearable',
      () => createClearableSlot(target),
      (current: ClearableHookSlot) => Object.is(current.target, target),
    );

    return slot.target as T;
  }

  ref<T>(initialValue: T): StateClosureRef<T> {
    const slot = this.useSlot(
      'ref',
      () => createRefSlot(initialValue),
      () => true,
    );

    return slot.value as StateClosureRef<T>;
  }

  render<T>(read: () => T): T {
    if (this.destroyed) {
      throw new TypeError('Cannot render with a destroyed state closure hook runtime.');
    }

    if (this.rendering) {
      throw new TypeError('Cannot re-enter a state closure hook runtime.');
    }

    const previousRuntime = setCurrentStateClosureHookRuntime(this);

    this.cursor = 0;

    this.draftRollbacks = [];

    this.draftSlots = [...this.slots];

    this.rendering = true;

    let readSucceeded = false;

    try {
      const result = read();

      if (this.destroyed) {
        throw new TypeError('Cannot finish rendering a destroyed state closure hook runtime.');
      }

      if (this.initialized && this.cursor !== this.slots.length) {
        throw hookOrderError();
      }

      readSucceeded = true;

      this.commitDraft();

      return result;
    } catch (error) {
      if (!readSucceeded) {
        this.rollbackDraft();
      }

      throw error;
    } finally {
      setCurrentStateClosureHookRuntime(previousRuntime);

      this.cursor = 0;

      this.draftRollbacks = null;

      this.draftSlots = null;

      this.rendering = false;
    }
  }

  complete() {
    if (this.destroyed || this.final) {
      return;
    }

    this.final = { type: 'complete' };

    BatchScheduler.batch(() => {
      for (const slot of this.slots) {
        slot.completeRawSources();
      }
    });
  }

  error(error: unknown) {
    if (this.destroyed || this.final) {
      return;
    }

    this.final = { type: 'error', error };

    BatchScheduler.batch(() => {
      for (const slot of this.slots) {
        slot.errorRawSources(error);
      }
    });
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    const slots = [...this.slots];

    if (this.draftSlots) {
      for (const slot of this.draftSlots) {
        if (!slots.includes(slot)) {
          slots.push(slot);
        }
      }
    }

    this.slots = [];

    destroySlots(slots);
  }
}
