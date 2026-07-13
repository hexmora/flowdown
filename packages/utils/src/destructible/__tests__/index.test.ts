import { describe, expect, test, vi } from 'vitest';

import { Destructible, type DestructibleTarget } from '..';

class TestDestructible extends Destructible {
  track<T extends DestructibleTarget>(value: T): T {
    return this.clearable(value);
  }
}

describe('Destructible', () => {
  test('returns and clears a tracked value with the owner', () => {
    const owner = new TestDestructible();
    const target = { destroy: vi.fn() };

    expect(owner.track(target)).toBe(target);

    owner.destroy();
    owner.destroy();

    expect(target.destroy).toHaveBeenCalledOnce();
  });
});
