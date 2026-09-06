/** @jsxImportSource ../../../../.. */
import { isEqual } from 'lodash-es';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  D,
  getMapperComparers,
  type IReadableClosure,
  memo,
  memoReturns,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  useCurrent,
} from '../../../../..';

function calculate(this: { scale: number }, value: number) {
  return this.scale * value;
}

describe('mapper memoization', () => {
  test('keeps comparer metadata on each wrapper without changing frozen mapper functions', () => {
    const original = Object.freeze(Object.assign(calculate, { label: 'scale' }));
    const wrapped = memo(original, Object.is);
    const returnsOnly = memoReturns(wrapped, isEqual);

    expect(wrapped).not.toBe(original);
    expect(returnsOnly).not.toBe(wrapped);
    expect(wrapped.label).toBe('scale');
    expect(wrapped.call({ scale: 2 }, 3)).toBe(6);
    expect(getMapperComparers(original)).toBeUndefined();
    expect(getMapperComparers(wrapped)).toEqual({ inputs: Object.is, returns: Object.is });
    expect(getMapperComparers(returnsOnly)).toEqual({ returns: isEqual });
    expect(Object.getOwnPropertySymbols(original)).toEqual([]);
    expectTypeOf(wrapped.label).toEqualTypeOf<string>();
  });

  test('uses shallow input equality and Object.is return equality by default', () => {
    const source = MutableState.of({ amount: 1 });
    const mapper = vi.fn(({ value }: { value: { amount: number } }) => ({ amount: value.amount }));
    const Memoed = memo(mapper);
    const closure = render(<Memoed value={source} />);
    const values: unknown[] = [];

    expect(mapper).not.toHaveBeenCalled();

    closure.value.subscribe((value) => values.push(value));

    expect(mapper).toHaveBeenCalledTimes(1);

    source.next({ amount: 1 });

    expect(mapper).toHaveBeenCalledTimes(2);
    expect(values).toHaveLength(2);

    source.next({ amount: 2 });

    expect(values).toEqual([{ amount: 1 }, { amount: 1 }, { amount: 2 }]);

    closure.destroy();
    source.destroy();
  });

  test('skips shallow-equal object inputs even when the state emits a new object', () => {
    const source = MutableState.of({ amount: 1 });
    const mapper = vi.fn((value: { amount: number }) => value.amount);
    const closure = render(S([memo(mapper), source]));

    expect(closure.value.value).toBe(1);

    source.next({ amount: 1 });

    expect(mapper).toHaveBeenCalledTimes(1);

    source.next({ amount: 2 });

    expect(closure.value.value).toBe(2);
    expect(mapper).toHaveBeenCalledTimes(2);

    closure.destroy();
    source.destroy();
  });

  test('accepts independent input and return comparers', () => {
    const source = MutableState.of({ amount: 1, revision: 0 });
    const mapper = vi.fn(({ amount }: { amount: number; revision: number }) => ({
      parity: amount % 2,
    }));
    const closure = render(
      S([memo(mapper, (left, right) => left.amount === right.amount, isEqual), source]),
    );
    const values: unknown[] = [];

    closure.value.subscribe((value) => values.push(value));

    source.next({ amount: 1, revision: 1 });

    expect(mapper).toHaveBeenCalledTimes(1);

    source.next({ amount: 3, revision: 2 });

    expect(mapper).toHaveBeenCalledTimes(2);
    expect(values).toEqual([{ parity: 1 }]);

    source.next({ amount: 4, revision: 3 });

    expect(values).toEqual([{ parity: 1 }, { parity: 0 }]);

    closure.destroy();
    source.destroy();
  });

  test('memoReturns filters emissions while running the mapper for every input change', () => {
    const source = MutableState.of(1);
    const mapper = vi.fn((amount: number) => ({ parity: amount % 2 }));
    const closure = render(S([memoReturns(mapper, isEqual), source]));
    const values: unknown[] = [];

    closure.value.subscribe((value) => values.push(value));

    source.next(3);
    source.next(4);

    expect(mapper).toHaveBeenCalledTimes(3);
    expect(values).toEqual([{ parity: 1 }, { parity: 0 }]);

    closure.destroy();
    source.destroy();
  });

  test('memoReturns defaults to Object.is', () => {
    const source = MutableState.of(1);
    const closure = render(S([memoReturns((value: number) => value % 2), source]));
    const values: number[] = [];

    closure.value.subscribe((value) => values.push(value));

    source.next(3);
    source.next(4);

    expect(values).toEqual([1, 0]);

    closure.destroy();
    source.destroy();
  });

  test('keeps input caches and current values local to each closure', () => {
    const source = MutableState.of(1);

    const Mapper = memo(({ value }: { value: number }) => {
      const current = useCurrent(() => ({ calls: 0 }));

      current.calls += 1;

      return { value, current };
    });

    const first = render(<Mapper value={source} />);
    const second = render(<Mapper value={source} />);

    expect(first.value.value.current).not.toBe(second.value.value.current);

    source.next(2);

    expect(first.value.value.current.calls).toBe(2);

    expect(second.value.value.current.calls).toBe(2);

    first.destroy();
    second.destroy();
    source.destroy();
  });

  test('preserves generic mapper signatures and D-wrapped inputs', () => {
    const identity = memo(<T,>({ value }: { value: T }) => value);
    const closure = render(S([identity, { value: D({ amount: 1 }) }]));

    expect(closure.value.value).toEqual({ amount: 1 });
    expectTypeOf(closure).toEqualTypeOf<IReadableClosure<{ amount: number }>>();

    closure.destroy();
  });

  test('rejects once functions and classes', () => {
    const Once = once(() => ReactiveState.of(1));

    class Class extends BaseStateClosure<number> {
      protected render() {
        return ReactiveState.of(1);
      }
    }

    // @ts-expect-error Memoization is only defined for mapper functions.
    expect(() => memo(Once)).toThrow('only be used with mapper functions');
    // @ts-expect-error Memoization is only defined for mapper functions.
    expect(() => memoReturns(Once)).toThrow('only be used with mapper functions');
    // @ts-expect-error Classes construct once and cannot be memoized.
    expect(() => memo(Class)).toThrow('only be used with mapper functions');
  });
});
