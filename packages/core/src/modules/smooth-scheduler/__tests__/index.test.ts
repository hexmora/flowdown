import { describe, expect, expectTypeOf, test } from 'vitest';

import type { IScheduler } from '..';
import type { SchedulerParams } from '../../../states/packs';
import type { Newable } from '../../../typings';

import { BaseSmoothScheduler, SpringSmoothScheduler } from '..';
import { ALL_SCHEDULERS } from '../../../states/packs';

class TestSmoothScheduler extends BaseSmoothScheduler {
  protected readonly defaultTuple = [1, 2];

  start(_timestamp: number, index = 0) {
    this.reset(index);
  }

  tick(_timestamp: number) {
    return this.fullIndex;
  }
}

describe('smooth scheduler exports', () => {
  test('exposes the spring scheduler constructor', () => {
    expect(ALL_SCHEDULERS).toEqual([SpringSmoothScheduler]);
    expect(SpringSmoothScheduler.name).toBe('spring');

    expectTypeOf(ALL_SCHEDULERS).toEqualTypeOf<Newable<IScheduler, SchedulerParams>[]>();
  });
});

describe('BaseSmoothScheduler', () => {
  test('uses the default tuple when no tuple is provided', () => {
    const scheduler = new TestSmoothScheduler();

    expect(scheduler.tuple).toEqual([1, 2]);
  });

  test('uses the provided tuple when its length matches the default', () => {
    const tuple = [3, 4];

    const scheduler = new TestSmoothScheduler(tuple);

    expect(scheduler.tuple).toBe(tuple);
  });

  test('validates tuple length when the tuple is read', () => {
    const scheduler = new TestSmoothScheduler([3]);

    expect(() => scheduler.tuple).toThrowError();
  });

  test('tracks pushed lengths and resets to an explicit index', () => {
    const scheduler = new TestSmoothScheduler();

    scheduler.push(5);

    expect(scheduler.tick(0)).toBe(5);

    scheduler.reset(3);

    expect(scheduler.tick(0)).toBe(3);

    scheduler.reset();

    expect(scheduler.tick(0)).toBe(0);
  });
});

describe('SpringSmoothScheduler', () => {
  test('exposes the default tuple', () => {
    const scheduler = new SpringSmoothScheduler();

    expect(scheduler.tuple).toEqual([20, 15, 1 / 700 / 1000, 2, 10 ** 5 + 1]);
  });

  test('requires start before ticking', () => {
    const scheduler = new SpringSmoothScheduler();

    expect(() => scheduler.tick(16)).toThrowError('Cannot tick without call start');
  });

  test('matches the spring response for a buffered append', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    scheduler.push(20);

    const distances: number[] = [];

    for (let timestamp = 16; timestamp <= 320; timestamp += 16) {
      distances.push(scheduler.tick(timestamp));
    }

    expect(distances).toEqual([0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]);
  });

  test('accelerates a large buffered append and drains without overshoot', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    scheduler.push(100);

    const distances: number[] = [];

    let cursor = 0;

    for (let timestamp = 16; timestamp <= 1_600; timestamp += 16) {
      const distance = scheduler.tick(timestamp);

      distances.push(distance);

      cursor += distance;

      expect(distance).toBeGreaterThanOrEqual(0);
      expect(cursor).toBeLessThanOrEqual(100);

      if (cursor === 100) {
        break;
      }
    }

    expect(cursor).toBe(100);
    expect(distances).toHaveLength(81);
    expect(distances.slice(0, 20)).toEqual([
      0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
    ]);
  });

  test('honors a valid custom tuple', () => {
    const scheduler = new SpringSmoothScheduler([1000, 0, 0, 1000, 1000]);

    scheduler.start(0);

    scheduler.push(20);

    expect([
      scheduler.tick(5),
      scheduler.tick(10),
      scheduler.tick(15),
      scheduler.tick(20),
      scheduler.tick(25),
    ]).toEqual([5, 5, 5, 5, 0]);
  });

  test('uses resume speed only after reaching the buffer wall', () => {
    const scheduler = new SpringSmoothScheduler([0, 15, 0.1, 1000, 10 ** 5]);

    scheduler.start(0, 20);

    scheduler.push(1);

    expect([scheduler.tick(1), scheduler.tick(2), scheduler.tick(3)]).toEqual([0, 0, 0]);
  });

  test('stops motion below the minimum observable speed', () => {
    const scheduler = new SpringSmoothScheduler([0.4, 0, 0, 0, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect([scheduler.tick(1000), scheduler.tick(2000), scheduler.tick(3000)]).toEqual([0, 0, 0]);
  });

  test('keeps motion above the minimum observable speed', () => {
    const scheduler = new SpringSmoothScheduler([0.75, 0, 0, 0, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect([scheduler.tick(1000), scheduler.tick(2000)]).toEqual([0, 1]);
  });

  test('discards momentum below the minimum observable speed', () => {
    const scheduler = new SpringSmoothScheduler([0.4, 0, 5e-8, 0, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect([
      scheduler.tick(1000),
      scheduler.tick(2000),
      scheduler.tick(3000),
      scheduler.tick(4000),
    ]).toEqual([0, 0, 0, 0]);
  });

  test('restores the initial speed when reset directly', () => {
    const scheduler = new SpringSmoothScheduler([1000, 0, 0, 0, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect(scheduler.tick(1)).toBe(1);
    expect(scheduler.tick(2)).toBe(0);

    scheduler.reset();
    scheduler.push(1);

    expect(scheduler.tick(3)).toBe(1);
  });

  test('smooths staggered chunks to completion without rollback or overshoot', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    let cursor = 0;

    let target = 0;

    const distances: number[] = [];

    for (let timestamp = 16; timestamp <= 1_600; timestamp += 16) {
      if (timestamp === 16) {
        scheduler.push(8);

        target += 8;
      }

      if (timestamp === 48) {
        scheduler.push(10);

        target += 10;
      }

      if (timestamp === 112) {
        scheduler.push(12);

        target += 12;
      }

      const distance = scheduler.tick(timestamp);

      distances.push(distance);

      cursor += distance;

      expect(distance).toBeGreaterThanOrEqual(0);
      expect(cursor).toBeLessThanOrEqual(target);

      if (timestamp > 112 && cursor === target) {
        break;
      }
    }

    expect(cursor).toBe(30);
    expect(distances).toHaveLength(76);
    expect(distances.slice(0, 20)).toEqual([
      0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1,
    ]);
  });

  test('matches the full response across an irregular long stream', () => {
    const scheduler = new SpringSmoothScheduler();
    const pushes = new Map([
      [1, 8],
      [3, 3],
      [7, 25],
      [9, 1],
      [16, 60],
      [29, 12],
      [31, 100],
    ]);

    scheduler.start(0);

    const distances: number[] = [];

    let cursor = 0;
    let target = 0;

    for (let frame = 1; frame <= 500; frame += 1) {
      const push = pushes.get(frame);

      if (push !== undefined) {
        scheduler.push(push);

        target += push;
      }

      const distance = scheduler.tick(frame * 16);

      distances.push(distance);

      cursor += distance;

      expect(cursor).toBeLessThanOrEqual(target);

      if (frame > 31 && cursor === target) {
        break;
      }
    }

    expect(cursor).toBe(209);
    expect(distances.join(',')).toBe(
      '0,0,0,1,0,1,0,0,1,0,0,1,0,1,0,0,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1,1,1,1,1,2,1,1,2,1,2,1,2,2,1,2,2,2,2,2,2,2,2,3,2,2,3,2,3,2,3,2,3,3,3,2,3,3,3,3,3,3,3,3,3,4,3,3,3,4,3,3,4,3,3,4,3,4,3,4,3,3,4,3,4,4,3,4,3,4,3,4,3,3',
    );
  });

  test('restarts from the requested index after reset', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(100, 4);

    scheduler.push(6);

    const firstRun = [116, 132, 148, 164, 180, 196].map((timestamp) => {
      return scheduler.tick(timestamp);
    });

    scheduler.start(300, 4);

    scheduler.push(2);

    const secondRun = [316, 332, 348, 364, 380, 396].map((timestamp) => {
      return scheduler.tick(timestamp);
    });

    expect(firstRun).toEqual([0, 0, 0, 1, 0, 1]);
    expect(secondRun).toEqual([0, 0, 0, 1, 0, 1]);
  });

  test('uses the absolute buffered position when starting from a non-zero index', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0, 20);

    scheduler.push(6);

    const distances: number[] = [];

    for (let timestamp = 16; timestamp <= 336; timestamp += 16) {
      distances.push(scheduler.tick(timestamp));
    }

    expect(distances).toEqual([0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1]);
  });

  test('preserves fractional progress when starting again', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    scheduler.push(6);

    for (const timestamp of [16, 32, 48, 64, 80]) {
      scheduler.tick(timestamp);
    }

    scheduler.start(100, 4);

    scheduler.push(2);

    expect(scheduler.tick(116)).toBe(1);
  });

  test('preserves fractional progress through a wall tick', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    scheduler.push(6);

    for (const timestamp of [16, 32, 48, 64, 80]) {
      scheduler.tick(timestamp);
    }

    scheduler.reset(4);

    expect(scheduler.tick(96)).toBe(0);

    scheduler.push(2);

    expect([112, 128, 144, 160, 176].map((timestamp) => scheduler.tick(timestamp))).toEqual([
      0, 1, 0, 0, 1,
    ]);
  });
});
