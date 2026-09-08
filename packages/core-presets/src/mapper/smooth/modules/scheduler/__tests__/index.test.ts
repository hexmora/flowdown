import { describe, expect, test } from 'vitest';

import { SpringSmoothScheduler } from '..';
import { TargetScheduler } from './utils';

describe('BaseSmoothScheduler', () => {
  test('provides defaults and retains an explicitly supplied tuple', () => {
    const tuple = [3, 4];

    expect(new TargetScheduler().tuple).toEqual([1, 2]);

    expect(new TargetScheduler(tuple).tuple).toBe(tuple);
  });

  test('rejects a tuple of the wrong length when read', () => {
    const scheduler = new TargetScheduler([3]);

    expect(() => scheduler.tuple).toThrow();
  });

  test('adds pushed lengths and resets to the requested target', () => {
    const scheduler = new TargetScheduler();

    scheduler.push(5);

    scheduler.push(2);

    expect(scheduler.tick(0)).toBe(7);

    scheduler.reset(3);

    expect(scheduler.tick(0)).toBe(3);

    scheduler.reset();

    expect(scheduler.tick(0)).toBe(0);
  });
});

describe('SpringSmoothScheduler', () => {
  test.each([
    {
      name: 'short initial content',
      tuple: [20, 15, 1 / 700 / 1000, 2, 100_000],
      initial: 3,
      idle: [329, 337],
      length: 19,
      timestamp: 392,
      distance: 0,
    },
    {
      name: 'custom buffer and elasticity',
      tuple: [80, 8, 0.00001, 4, 200],
      initial: 10,
      idle: [403],
      length: 18,
      timestamp: 483,
      distance: 6,
    },
  ])(
    'resumes consistently after idle frames with $name',
    ({ tuple, initial, idle, length, timestamp, distance }) => {
      const scheduler = new SpringSmoothScheduler(tuple);

      scheduler.start(0, initial);

      expect(idle.map((time) => scheduler.tick(time))).toEqual(idle.map(() => 0));

      scheduler.push(length);

      expect(scheduler.tick(timestamp)).toBe(distance);
    },
  );

  test('retains speed when a frame exhausts the available buffer', () => {
    const scheduler = new SpringSmoothScheduler([1000, 0, 0, 2, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect(scheduler.tick(2)).toBe(1);

    scheduler.push(100);

    expect([3, 4, 5, 6, 7].map((time) => scheduler.tick(time))).toEqual([1, 1, 1, 1, 1]);
  });

  test('resumes after waiting on an initially empty buffer', () => {
    const scheduler = new SpringSmoothScheduler([0, 0, 0, 1000, 1000]);

    scheduler.start(0);

    expect(scheduler.tick(1)).toBe(0);

    scheduler.push(10);

    expect([2, 3].map((time) => scheduler.tick(time))).toEqual([1, 1]);
  });

  test('exposes the chosen default tuple and constructor name', () => {
    expect(SpringSmoothScheduler.name).toBe('spring');
    // The target deliberately raises the source default maximum speed by one.

    expect(new SpringSmoothScheduler().tuple).toEqual([20, 15, 1 / 700 / 1000, 2, 100_001]);
  });

  test('requires start before ticking', () => {
    expect(() => new SpringSmoothScheduler().tick(16)).toThrow('Cannot tick without call start');
  });

  test('matches the buffered append response', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    scheduler.push(20);

    const distances = Array.from({ length: 20 }, (_, index) => scheduler.tick((index + 1) * 16));

    expect(distances).toEqual([0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]);
  });

  test.each([
    {
      name: 'large buffered append',
      pushes: [[1, 100]],
      target: 100,
      frames: 81,
      prefix: [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
    },
    {
      name: 'staggered chunks',
      pushes: [
        [1, 8],
        [3, 10],
        [7, 12],
      ],
      target: 30,
      frames: 76,
      prefix: [0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1],
    },
  ])('drains $name without rollback or overshoot', ({ pushes, target, frames, prefix }) => {
    const arrivals = new Map(pushes.map(([frame = 0, length = 0]) => [frame, length]));

    const scheduler = new SpringSmoothScheduler();

    const distances: number[] = [];

    let cursor = 0;

    let available = 0;

    scheduler.start(0);

    for (let frame = 1; frame <= 100 && cursor < target; frame += 1) {
      const length = arrivals.get(frame) ?? 0;

      scheduler.push(length);

      available += length;

      const distance = scheduler.tick(frame * 16);

      distances.push(distance);

      cursor += distance;

      expect(Number.isInteger(distance)).toBe(true);

      expect(distance).toBeGreaterThanOrEqual(0);

      expect(cursor).toBeLessThanOrEqual(available);
    }

    expect(cursor).toBe(target);

    expect(distances).toHaveLength(frames);

    expect(distances.slice(0, prefix.length)).toEqual(prefix);
  });

  test('matches every frame of an irregular long stream', () => {
    const arrivals = new Map([
      [1, 8],
      [3, 3],
      [7, 25],
      [9, 1],
      [16, 60],
      [29, 12],
      [31, 100],
    ]);

    const scheduler = new SpringSmoothScheduler();

    const distances: number[] = [];

    let cursor = 0;

    let target = 0;

    scheduler.start(0);

    for (let frame = 1; frame <= 500; frame += 1) {
      const length = arrivals.get(frame) ?? 0;

      scheduler.push(length);

      target += length;

      const distance = scheduler.tick(frame * 16);

      distances.push(distance);

      cursor += distance;

      expect(distance).toBeGreaterThanOrEqual(0);

      expect(cursor).toBeLessThanOrEqual(target);

      if (frame > 31 && cursor === target) {
        break;
      }
    }

    expect(cursor).toBe(209);

    expect(distances).toEqual([
      0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1,
      1, 1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 3, 2, 3, 2, 3, 2,
      3, 3, 3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 4, 3, 3, 4, 3, 3, 4, 3, 4, 3, 4, 3, 3, 4,
      3, 4, 4, 3, 4, 3, 4, 3, 4, 3, 3,
    ]);
  });

  test('honors a supplied tuple including a constant maximum speed', () => {
    const tuple = [1000, 0, 0, 1000, 1000];

    const scheduler = new SpringSmoothScheduler(tuple);

    scheduler.start(0);

    scheduler.push(20);

    expect(scheduler.tuple).toBe(tuple);

    expect([5, 10, 15, 20, 25].map((time) => scheduler.tick(time))).toEqual([5, 5, 5, 5, 0]);
  });

  test('uses resume speed only after reaching the buffer wall', () => {
    const scheduler = new SpringSmoothScheduler([0, 15, 0.1, 1000, 100_000]);

    scheduler.start(0, 20);

    scheduler.push(1);

    expect([1, 2, 3].map((time) => scheduler.tick(time))).toEqual([0, 0, 0]);
  });

  test('resumes from the buffer wall at the retained speed', () => {
    const scheduler = new SpringSmoothScheduler([1000, 0, 0, 2, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect([scheduler.tick(1), scheduler.tick(2)]).toEqual([1, 0]);

    scheduler.push(10);

    expect([scheduler.tick(3), scheduler.tick(4)]).toEqual([0, 1]);
  });

  test.each([
    { name: 'below the threshold', tuple: [0.4, 0, 0, 0, 1000], expected: [0, 0, 0] },
    { name: 'above the threshold', tuple: [0.75, 0, 0, 0, 1000], expected: [0, 1] },
    {
      name: 'discarded subthreshold momentum',
      tuple: [0.4, 0, 5e-8, 0, 1000],
      expected: [0, 0, 0, 0],
    },
  ])('handles $name', ({ tuple, expected }) => {
    const scheduler = new SpringSmoothScheduler(tuple);

    scheduler.start(0);

    scheduler.push(1);

    expect(expected.map((_, index) => scheduler.tick((index + 1) * 1000))).toEqual(expected);
  });

  test('restores initial speed after a direct reset', () => {
    const scheduler = new SpringSmoothScheduler([1000, 0, 0, 0, 1000]);

    scheduler.start(0);

    scheduler.push(1);

    expect(scheduler.tick(1)).toBe(1);

    expect(scheduler.tick(2)).toBe(0);

    scheduler.reset();

    scheduler.push(1);

    expect(scheduler.tick(3)).toBe(1);
  });

  test('restarts timing from the requested index', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(100, 4);

    scheduler.push(6);

    expect([116, 132, 148, 164, 180, 196].map((time) => scheduler.tick(time))).toEqual([
      0, 0, 0, 1, 0, 1,
    ]);

    scheduler.start(300, 4);

    scheduler.push(2);

    expect([316, 332, 348, 364, 380, 396].map((time) => scheduler.tick(time))).toEqual([
      0, 0, 0, 1, 0, 1,
    ]);
  });

  test('uses absolute position when starting with visible content', () => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0, 20);

    scheduler.push(6);

    expect(Array.from({ length: 21 }, (_, index) => scheduler.tick((index + 1) * 16))).toEqual([
      0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1,
    ]);
  });

  test.each(['start', 'reset'] as const)('retains fractional progress through %s', (operation) => {
    const scheduler = new SpringSmoothScheduler();

    scheduler.start(0);

    scheduler.push(6);

    for (const time of [16, 32, 48, 64, 80]) {
      scheduler.tick(time);
    }

    if (operation === 'start') {
      scheduler.start(100, 4);

      scheduler.push(2);

      expect(scheduler.tick(116)).toBe(1);
    } else {
      scheduler.reset(4);

      expect(scheduler.tick(96)).toBe(0);

      scheduler.push(2);

      expect([112, 128, 144, 160, 176].map((time) => scheduler.tick(time))).toEqual([
        0, 1, 0, 0, 1,
      ]);
    }
  });

  test('ignores repeated or backward timestamps without shifting forward timing', () => {
    const scheduler = new SpringSmoothScheduler([1000, 0, 0, 1000, 1000]);

    scheduler.start(10);

    scheduler.push(10);

    expect([15, 15, 12, 16].map((time) => scheduler.tick(time))).toEqual([5, 0, 0, 1]);
  });
});
