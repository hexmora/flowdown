import { isFunction } from 'lodash-es';
import { Subject } from 'rxjs';

import type { DestructibleTarget, IDestructible } from './type';

import { isDestructible } from './utils';

export * from './type';

export class Destructible implements IDestructible {
  private readonly targets: DestructibleTarget[] = [];

  protected destroyed = false;

  private runTarget(target: DestructibleTarget) {
    if (target instanceof Subject) {
      target.complete();

      return;
    }

    if (isDestructible(target)) {
      target.destroy();

      return;
    }

    if (isFunction(target)) {
      target();

      return;
    }

    target.unsubscribe();
  }

  protected clearable<T extends DestructibleTarget>(value: T): T {
    this.targets.push(value);

    return value;
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    for (const target of this.targets) {
      this.runTarget(target);
    }

    this.targets.splice(0);
  }
}
