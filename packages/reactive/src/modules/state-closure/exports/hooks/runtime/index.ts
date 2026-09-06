import { Subscription } from 'rxjs';

import type { DestructibleTarget } from '../../../../destructible';
import type { IReadableClosure } from '../../../type';
import type { StateClosureRef } from '../type';
import type { HookSlot } from './type';

import { clearByTarget } from '../../../../destructible/utils';
import {
  getReadableClosureScope,
  ownReadableClosure,
  releaseReadableClosure,
} from '../../render/utils/context';
import { isReadableClosure } from '../../render/utils/resolve';
import { hookOrderError, withStateClosureHookRuntime } from './utils';

export * from './type';

export class StateClosureHookRuntime {
  private cursor = 0;

  private initialized = false;

  private readonly slots: HookSlot[] = [];

  readonly kind: 'mapper' | 'once';

  readonly owner: IReadableClosure<unknown>;

  constructor(kind: 'mapper' | 'once', owner: IReadableClosure<unknown>) {
    this.kind = kind;

    this.owner = owner;
  }

  private useSlot<T extends HookSlot>(type: T['type'], create: () => T): T {
    const index = this.cursor;

    this.cursor += 1;

    const slot = this.slots[index];

    if (slot ? slot.type !== type : this.initialized) {
      throw hookOrderError();
    }

    if (!slot) {
      this.slots[index] = create();
    }

    return this.slots[index] as T;
  }

  clearable<T extends DestructibleTarget>(target: T): T {
    const slot = this.useSlot('clearable', () => ({ type: 'clearable', target }));

    if (isReadableClosure(target)) {
      ownReadableClosure(getReadableClosureScope(this.owner), target);
    }

    if (slot.target !== target) {
      const previous = slot.target;

      slot.target = target;

      this.clearTarget(previous);
    }

    return target;
  }

  private clearTarget(target: DestructibleTarget) {
    if (isReadableClosure(target)) {
      releaseReadableClosure(getReadableClosureScope(this.owner), target);
    } else {
      clearByTarget(target);
    }
  }

  ref<T>(initialValue: T): StateClosureRef<T> {
    const slot = this.useSlot('ref', () => ({ type: 'ref', value: { current: initialValue } }));

    return slot.value as StateClosureRef<T>;
  }

  current<T>(factory: () => T): T {
    const slot = this.useSlot('current', () => ({
      type: 'current',

      value: withStateClosureHookRuntime(null, factory),
    }));

    return slot.value as T;
  }

  render<T>(read: () => T): T {
    this.cursor = 0;

    return withStateClosureHookRuntime(this, () => {
      const result = read();

      if (this.initialized && this.cursor !== this.slots.length) {
        throw hookOrderError();
      }

      this.initialized = true;

      return result;
    });
  }

  destroy() {
    const cleanup = new Subscription();

    for (const slot of this.slots.splice(0)) {
      if (slot.type === 'clearable') {
        cleanup.add(() => this.clearTarget(slot.target));
      }
    }

    cleanup.unsubscribe();
  }
}
