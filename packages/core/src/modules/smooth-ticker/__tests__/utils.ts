import { BaseSmoothTicker } from '../base';

export class FakeSmoothTicker extends BaseSmoothTicker {
  destroyCalls = 0;

  private active = false;

  private currentTime: number;

  constructor(initialTime = 0) {
    super();

    this.currentTime = initialTime;
  }

  override get running() {
    return this.active;
  }

  start() {
    if (this.active) {
      throw new Error('Cannot start a running ticker');
    }

    this.active = true;

    return this.currentTime;
  }

  stop() {
    if (!this.active) {
      throw new Error('Cannot stop a stopping ticker');
    }

    this.active = false;
  }

  tick(timestamp: number) {
    if (!this.active) {
      throw new Error('Cannot tick a stopping ticker');
    }

    if (timestamp < this.currentTime) {
      throw new Error('Cannot tick previous timestamp');
    }

    this.currentTime = timestamp;

    this.subject.next(timestamp);
  }

  advanceTo(timestamp: number) {
    if (this.active) {
      throw new Error('Cannot advance a running ticker');
    }

    if (timestamp < this.currentTime) {
      throw new Error('Cannot advance to previous timestamp');
    }

    this.currentTime = timestamp;
  }

  override destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyCalls += 1;

    if (this.active) {
      this.stop();
    }

    super.destroy();
  }
}
