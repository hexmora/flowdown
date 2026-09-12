import type { DestructibleTarget, IDestructible } from './type';

import { clearByTarget } from './utils';

export * from './type';

export class Destructible implements IDestructible {
  private readonly targets: DestructibleTarget[] = [];

  protected destroyed = false;

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
      clearByTarget(target);
    }

    this.targets.splice(0);
  }
}
