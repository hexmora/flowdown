import { isEqual } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  BatchScheduler,
  combineMapClosure,
  D,
  type IReadableClosure,
  mapClosure,
  mapEachClosure,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  toClosure,
  useClearable,
  useMap,
  useMapEach,
} from '../../../..';

describe('mapEachClosure', () => {
  test('keeps downstream priorities linked to later entries and their dependencies', () => {
    const source = MutableState.of([0]);

    const value = MutableState.of(2);

    const child = mapClosure(value, (current) => current);

    const items = mapEachClosure(source, (_item, index) =>
      index === 0 ? ReactiveState.of(0) : child,
    );

    const output = mapClosure(items, (current) => current);

    const initial = BatchScheduler.getPriority(output.value);

    source.next([0, 1]);

    expect(output.value.value).toEqual([0, 2]);

    expect(BatchScheduler.getPriority(output.value)).toBeGreaterThan(initial);

    BatchScheduler.setPriority(value, 20);

    expect(BatchScheduler.getPriority(output.value)).toBeGreaterThan(20);

    output.destroy();

    items.destroy();

    source.destroy();

    value.destroy();
  });

  test('defers reading the list and constructing its children until the first value access', () => {
    const started = vi.fn();

    class Source extends BaseStateClosure<number[]> {
      protected render() {
        started();

        return ReactiveState.of([1, 2]);
      }
    }

    const mapper = vi.fn((item: IReadableClosure<number>) =>
      mapClosure(item, (value) => value * 2),
    );
    const closure = mapEachClosure(new Source(), mapper);

    expect(started).not.toHaveBeenCalled();
    expect(mapper).not.toHaveBeenCalled();
    expect(closure.value.value).toEqual([2, 4]);
    expect(started).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledTimes(2);

    closure.destroy();

    const unused = mapEachClosure(new Source(), mapper);

    unused.destroy();

    expect(() => unused.value).toThrow('Cannot set up a destroyed state closure');
    expect(started).toHaveBeenCalledOnce();
    expect(mapper).toHaveBeenCalledTimes(2);
  });

  test('reuses positions, batches item updates, and releases removed children', () => {
    const source = MutableState.of([1, 2]);
    const items: IReadableClosure<number>[] = [];
    const mapper = vi.fn((item: IReadableClosure<number>, index: number) => {
      items.push(item);

      return mapClosure(item, (value) => ({ value, index }));
    });

    const closure = mapEachClosure(source, mapper);
    const next = vi.fn();

    closure.value.subscribe(next);
    next.mockClear();

    source.next([3, 4]);

    expect(closure.value.value).toEqual([
      { value: 3, index: 0 },
      { value: 4, index: 1 },
    ]);
    expect(mapper).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledOnce();

    source.next([3, 5, 4]);

    expect(mapper).toHaveBeenCalledTimes(3);
    expect(items[1].value.value).toBe(5);
    expect(closure.value.value[2]).toEqual({ value: 4, index: 2 });

    source.next([3]);

    expect(items[0].value.closed).toBe(false);
    expect(items[1].value.closed).toBe(true);
    expect(items[2].value.closed).toBe(true);

    source.next([]);
    source.next([6]);

    expect(items[0].value.closed).toBe(true);
    expect(mapper).toHaveBeenCalledTimes(4);
    expect(closure.value.value).toEqual([{ value: 6, index: 0 }]);

    closure.destroy();

    expect(items[3].value.closed).toBe(true);
    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('follows child values and emits one settled list for a batched dependency update', () => {
    const source = MutableState.of([1, 2]);
    const scale = MutableState.of(2);
    const closure = mapEachClosure(source, (item) =>
      combineMapClosure([item, scale], ([value, currentScale]) => value * currentScale),
    );

    const next = vi.fn();

    closure.value.subscribe(next);
    next.mockClear();

    BatchScheduler.batch(() => {
      source.next([2, 3]);
      scale.next(3);
    });

    expect(closure.value.value).toEqual([6, 9]);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith([6, 9]);

    closure.destroy();
    source.destroy();
    scale.destroy();
  });

  test('supports item comparers and suppresses equal result lists', () => {
    const source = MutableState.of([{ value: 1 }]);
    const read = vi.fn((item: { value: number }) => item.value);
    const closure = mapEachClosure(source, (item) => mapClosure(item, read), isEqual);
    const next = vi.fn();

    closure.value.subscribe(next);
    read.mockClear();
    next.mockClear();

    source.next([{ value: 1 }]);

    expect(read).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    source.next([{ value: 2 }]);

    expect(read).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(closure.value.value).toEqual([2]);

    closure.destroy();
    source.destroy();
  });

  test('retains shared child closures until their last position is removed', () => {
    const source = MutableState.of([1, 2]);
    const producer = new BehaviorSubject(3);
    const shared = toClosure(producer);
    const closure = mapEachClosure(source, () => shared);

    expect(closure.value.value).toEqual([3, 3]);

    source.next([1]);
    producer.next(4);

    expect(shared.value.closed).toBe(false);
    expect(closure.value.value).toEqual([4]);

    source.next([]);

    expect(shared.value.closed).toBe(true);
    expect(producer.observed).toBe(false);
    expect(producer.isStopped).toBe(false);

    closure.destroy();
    source.destroy();
    producer.complete();
  });

  test('releases every constructed child when initial setup fails', () => {
    const cleanup = vi.fn();
    const failure = new Error('Failed to build a child.');
    const Child = once(({ index }: { index: number }) => {
      useClearable(cleanup);

      if (index === 1) {
        throw failure;
      }

      return ReactiveState.of(index);
    });

    const closure = mapEachClosure([1, 2, 3], (_item, index) => S([Child, { index: D(index) }]));

    expect(() => closure.value).toThrow(failure);
    expect(cleanup).toHaveBeenCalledTimes(2);

    closure.destroy();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test('reports later construction failures and releases new children without destroying existing ones', () => {
    const source = MutableState.of([1]);
    const cleaned: number[] = [];
    const failure = new Error('Failed to append a child.');
    const Child = once(({ index }: { index: number }) => {
      useClearable(() => cleaned.push(index));

      if (index === 2) {
        throw failure;
      }

      return ReactiveState.of(index);
    });

    const closure = mapEachClosure(source, (_item, index) => S([Child, { index: D(index) }]));
    const error = vi.fn();

    closure.value.subscribe({ error });

    expect(() => source.next([1, 2, 3])).not.toThrow();
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(failure);
    expect(cleaned).toEqual([2, 1]);

    closure.destroy();

    expect(cleaned).toEqual([2, 1, 0]);
    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('keeps child flows reactive after the list completes and detaches borrowed sources', () => {
    const source = new BehaviorSubject([1]);
    const producer = new BehaviorSubject(2);
    const closure = mapEachClosure(source, (item) =>
      combineMapClosure([item, producer], ([value, current]) => value + current),
    );

    expect(closure.value.value).toEqual([3]);

    source.complete();
    producer.next(3);

    expect(closure.value.closed).toBe(false);
    expect(closure.value.value).toEqual([4]);

    closure.destroy();

    expect(producer.observed).toBe(false);
    expect(producer.isStopped).toBe(false);

    producer.complete();
  });

  test('supports once hooks and class methods while keeping the item callback outside hook contexts', () => {
    const Child = once(({ item }: { item: IReadableClosure<number> }) =>
      useMap(item, (value) => value * 2),
    );

    const Once = once(({ items }: { items: IReadableClosure<number[]> }) =>
      useMapEach(items, (item) => S([Child, { item }])),
    );

    class Class extends BaseStateClosure<number[], { items: IReadableClosure<number[]> }> {
      protected render() {
        const { items } = this.inputs;

        return this.mapEach(items, (item) => S([Child, { item }]));
      }
    }

    const fromOnce = render(S([Once, { items: [1, 2] }]));
    const fromClass = render(S([Class, { items: [1, 2] }]));

    expectTypeOf(fromOnce).toEqualTypeOf<IReadableClosure<number[]>>();
    expect(fromOnce.value.value).toEqual([2, 4]);
    expect(fromClass.value.value).toEqual([2, 4]);
    expect(() => useMapEach([1], (item) => item)).toThrow(
      'useMapEach can only be used in once functions',
    );

    const invalid = mapEachClosure([1], (item) => useMap(item, (value) => value));

    expect(() => invalid.value).toThrow('useMap can only be used in once functions');

    fromOnce.destroy();
    fromClass.destroy();
    invalid.destroy();
  });
});
