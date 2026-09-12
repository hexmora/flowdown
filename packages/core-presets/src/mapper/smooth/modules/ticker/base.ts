import { Destructible } from 'functive';
import { Subject } from 'rxjs';

import type { ITicker } from './type';

export abstract class BaseSmoothTicker extends Destructible implements ITicker {
  protected readonly subject = new Subject<number>();

  readonly value = this.subject.asObservable();

  abstract get running(): boolean;

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
