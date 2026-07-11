import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import { cacheDiffMap, enumerate } from '../common';

describe('enumerate', () => {
  test('adds zero-based indexes to array items', () => {
    const result = enumerate(['first', 'second'] as const);

    expectTypeOf(result).toEqualTypeOf<[number, 'first' | 'second'][]>();
    expect(result).toEqual([
      [0, 'first'],
      [1, 'second'],
    ]);
  });

  test('supports arbitrary iterables', () => {
    expect(enumerate(['first', 'second'].values())).toEqual([
      [0, 'first'],
      [1, 'second'],
    ]);
  });
});

describe('cacheDiffMap', () => {
  test('maps every current value when there are no previous entries', () => {
    const mapper = vi.fn((source: string) => `new:${source}`);

    const result = cacheDiffMap({
      prev: [],
      current: ['first', 'second'],
      mapper,
    });

    expect(result).toEqual(['new:first', 'new:second']);
    expect(mapper.mock.calls).toEqual([['first'], ['second']]);
  });

  test('reuses, creates, removes, and orders mapped values', () => {
    const mapper = vi.fn((source: string) => `new:${source}`);
    const teardown = vi.fn();

    const result = cacheDiffMap({
      prev: [
        ['removed', 'old:removed'],
        ['second', 'old:second'],
        ['first', 'old:first'],
      ],
      current: ['first', 'added', 'second'],
      mapper,
      teardown,
    });

    expect(result).toEqual(['old:first', 'new:added', 'old:second']);
    expect(mapper).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledWith('added');
    expect(teardown).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledWith('old:removed', 'removed');
  });

  test('accepts a Map as the previous value', () => {
    const mapper = vi.fn((source: string) => source.toUpperCase());

    const result = cacheDiffMap({
      prev: new Map([
        ['second', 'existing:second'],
        ['first', 'existing:first'],
      ]),
      current: ['first', 'added', 'second'],
      mapper,
    });

    expect(result).toEqual(['existing:first', 'ADDED', 'existing:second']);
    expect(mapper).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledWith('added');
  });

  test('uses Object.is by default', () => {
    const nanValue = { source: 'nan' };
    const positiveZeroValue = { source: 'positive-zero' };
    const mapper = vi.fn((source: number) => ({ source }));
    const teardown = vi.fn();

    const result = cacheDiffMap({
      prev: [
        [Number.NaN, nanValue],
        [0, positiveZeroValue],
      ],
      current: [Number.NaN, -0],
      mapper,
      teardown,
    });

    expect(result[0]).toBe(nanValue);
    expect(Object.is(result[1]?.source, -0)).toBe(true);
    expect(mapper).toHaveBeenCalledOnce();
    expect(Object.is(mapper.mock.calls[0]?.[0], -0)).toBe(true);
    expect(teardown).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledWith(positiveZeroValue, 0);
  });

  test('uses comparer to match values of type T', () => {
    interface Source {
      id: number;
      label: string;
    }

    const keptSource: Source = { id: 1, label: 'old-kept' };
    const removedSource: Source = { id: 3, label: 'old-removed' };
    const currentKeptSource: Source = { id: 1, label: 'new-kept' };
    const addedSource: Source = { id: 2, label: 'new-added' };
    const mapper = vi.fn((source: Source) => `new:${source.label}`);
    const teardown = vi.fn();
    const comparer = vi.fn((left: Source, right: Source) => left.id === right.id);

    const result = cacheDiffMap({
      prev: [
        [keptSource, 'existing:kept'],
        [removedSource, 'existing:removed'],
      ],
      current: [currentKeptSource, addedSource],
      mapper,
      teardown,
      comparer,
    });

    expect(result).toEqual(['existing:kept', 'new:new-added']);
    expect(mapper).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledWith(addedSource);
    expect(teardown).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledWith('existing:removed', removedSource);
    expect(comparer).toHaveBeenCalled();
  });

  test('matches duplicate values one-to-one', () => {
    const mapper = vi.fn((source: string) => `new:${source}`);
    const teardown = vi.fn();

    const result = cacheDiffMap({
      prev: [
        ['same', 'existing:first'],
        ['same', 'existing:second'],
        ['removed', 'existing:removed'],
      ],
      current: ['same', 'same', 'same'],
      mapper,
      teardown,
    });

    expect(result).toEqual(['existing:first', 'existing:second', 'new:same']);
    expect(mapper).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledWith('same');
    expect(teardown).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledWith('existing:removed', 'removed');
  });

  test('tears down every previous value when current is empty', () => {
    const mapper = vi.fn((source: string) => source);
    const teardown = vi.fn();

    const result = cacheDiffMap({
      prev: [
        ['first', 'existing:first'],
        ['second', 'existing:second'],
      ],
      current: [],
      mapper,
      teardown,
    });

    expect(result).toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
    expect(teardown.mock.calls).toEqual([
      ['existing:first', 'first'],
      ['existing:second', 'second'],
    ]);
  });
});
