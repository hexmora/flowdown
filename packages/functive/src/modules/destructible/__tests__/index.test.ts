import { Destructible, type DestructibleTarget } from '../index';

class TestDestructible extends Destructible {
  track<T extends DestructibleTarget>(value: T): T {
    return this.clearable(value);
  }
}

describe('Destructible', () => {
  test('returns and clears a tracked value with the owner', () => {
    const owner = new TestDestructible();
    const target = { destroy: jest.fn() };

    expect(owner.track(target)).toBe(target);

    owner.destroy();
    owner.destroy();

    expect(target.destroy).toHaveBeenCalledTimes(1);
  });
});
