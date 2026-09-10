import { values } from 'lodash-es';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IReadableClosure } from '../../..';

import { combineState, flattenClosure, mapClosure, MutableState, ReactiveState } from '../../..';

describe('flattenClosure', () => {
  test('creates stable fields without a hook scope and subscribes only to consumed fields', () => {
    const item = { id: 1 };

    const source = MutableState.of({ count: 1, item });

    const subscribe = vi.spyOn(source, 'subscribe');

    const fields = flattenClosure(source);

    expectTypeOf(fields.count).toEqualTypeOf<IReadableClosure<number>>();

    expectTypeOf(fields.item).toEqualTypeOf<IReadableClosure<{ id: number }>>();

    expect(subscribe).not.toHaveBeenCalled();

    const count = fields.count;

    expect(count.value.value).toBe(1);

    expect(subscribe).toHaveBeenCalledOnce();

    const itemNext = vi.fn();

    fields.item.value.subscribe(itemNext);

    itemNext.mockClear();

    source.next({ count: 2, item });

    expect(fields.count).toBe(count);

    expect(count.value.value).toBe(2);

    expect(itemNext).not.toHaveBeenCalled();

    values(fields).forEach((field) => field.destroy());

    expect(subscribe.mock.results.every(({ value }) => value.closed)).toBe(true);

    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('publishes simultaneous field changes as one consistent configuration', () => {
    const source = MutableState.of({ ticker: 'first', scheduler: 'slow' });

    const fields = flattenClosure(source);

    const combined = combineState(fields.ticker, fields.scheduler);

    const next = vi.fn();

    combined.subscribe(next);

    next.mockClear();

    source.next({ ticker: 'second', scheduler: 'fast' });

    expect(next).toHaveBeenCalledExactlyOnceWith(['second', 'fast']);

    combined.destroy();

    values(fields).forEach((field) => field.destroy());

    source.destroy();
  });

  test('keeps completed source values and completes each field', () => {
    const fields = flattenClosure(ReactiveState.of({ count: 3, label: 'done' }));

    expect(fields.count.value.value).toBe(3);

    expect(fields.label.value.value).toBe('done');

    expect(fields.count.value.closed).toBe(true);

    expect(fields.label.value.closed).toBe(true);

    values(fields).forEach((field) => field.destroy());
  });

  test('releases fields without taking ownership of a caller-provided closure', () => {
    const input = MutableState.of({ count: 1 });

    const source = mapClosure(input, (value) => value);

    const destroy = vi.spyOn(source, 'destroy');

    const fields = flattenClosure(source);

    expect(fields.count.value.value).toBe(1);

    fields.count.destroy();

    fields.count.destroy();

    expect(destroy).not.toHaveBeenCalled();

    input.next({ count: 2 });

    expect(source.value.value).toEqual({ count: 2 });

    expect(input.closed).toBe(false);

    source.destroy();

    input.destroy();
  });
});
