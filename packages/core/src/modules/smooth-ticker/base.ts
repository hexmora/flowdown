import { Destructible } from '@flowdown/utils';
import { Subject } from 'rxjs';

import type { ITicker } from './type';

export abstract class BaseSmoothTicker extends Destructible implements ITicker {
  protected readonly subject = new Subject<number>();

  protected runningState = false;

  readonly value = this.subject.asObservable();

  get running() {
    return this.runningState;
  }

  abstract start(): number;

  abstract stop(): void;

  override destroy() {
    if (this.destroyed) {
      return;
    }

    if (this.running) {
      this.stop();
    }

    this.subject.complete();

    super.destroy();
  }
}
