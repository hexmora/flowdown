import { expectTypeOf } from 'expect-type';
import { shallowEqual } from 'shallow-equal';

import {
  BaseStateClosure,
  BatchScheduler,
  D,
  type IReadableClosure,
  mapClosure,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  switchMapClosure,
  useClearable,
  useCreate,
  useMap,
  useSwitchMap,
} from '../../../../index';

describe('switchMapClosure', () => {
  test.each(['hook', 'member'] as const)(
    'owns lazy child replacements through the %s API',
    (api) => {
      const source = MutableState.of(0);

      const values = [MutableState.of(1), MutableState.of(2)];

      const cleaned = jest.fn();

      const Child = once(({ index }: { index: number }) => {
        useClearable(() => cleaned(index));

        return values[index];
      });

      const mapper = jest.fn((index: number) => S([Child, { index: D(index) }]));

      const Once = once((inputs: { source: IReadableClosure<number> }) =>
        useSwitchMap(inputs.source, mapper),
      );

      class Class extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
        protected render() {
          return this.switchMap(this.inputs.source, mapper);
        }
      }

      const output =
        api === 'hook' ? render(S([Once, { source }])) : render(S([Class, { source }]));

      expect(mapper).not.toHaveBeenCalled();

      expect(output.value.value).toBe(1);

      expect(mapper).toHaveBeenCalledTimes(1);
      expect(mapper).toHaveBeenCalledWith(0);

      source.next(1);

      expect(output.value.value).toBe(2);

      expect(cleaned).toHaveBeenCalledTimes(1);
      expect(cleaned).toHaveBeenCalledWith(0);

      values[0].next(3);

      expect(output.value.value).toBe(2);

      values[1].next(4);

      expect(output.value.value).toBe(4);

      output.destroy();

      output.destroy();

      expect(cleaned.mock.calls).toEqual([[0], [1]]);

      expect(source.closed).toBe(false);

      expect(values.every((value) => !value.closed)).toBe(true);

      mapper.mockClear();

      const unused =
        api === 'hook' ? render(S([Once, { source }])) : render(S([Class, { source }]));

      unused.destroy();

      expect(mapper).not.toHaveBeenCalled();

      source.destroy();

      values.forEach((value) => value.destroy());
    },
  );

  test.each(['hook', 'member'] as const)(
    'infers descriptor lists and compares rendered results through the %s API',
    (api) => {
      const source = MutableState.of(1);

      const mapper = jest.fn((value: number) => [D(value % 2), D(2)]);

      const Once = once((inputs: { source: IReadableClosure<number> }) => {
        const output = useSwitchMap(inputs.source, mapper, shallowEqual);

        expectTypeOf(output).toEqualTypeOf<IReadableClosure<number[]>>();

        return output;
      });

      class Class extends BaseStateClosure<number[], { source: IReadableClosure<number> }> {
        protected render() {
          const output = this.switchMap(this.inputs.source, mapper, shallowEqual);

          expectTypeOf(output).toEqualTypeOf<IReadableClosure<number[]>>();

          return output;
        }
      }

      const output =
        api === 'hook' ? render(S([Once, { source }])) : render(S([Class, { source }]));

      const next = jest.fn();

      output.value.subscribe(next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith([1, 2]);

      next.mockClear();

      source.next(3);

      expect(mapper).toHaveBeenCalledTimes(2);

      expect(next).not.toHaveBeenCalled();

      source.next(4);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith([0, 2]);

      output.destroy();

      source.destroy();
    },
  );

  test.each(['hook', 'member'] as const)(
    'preserves immediate closure types and ownership through the %s API',
    (api) => {
      const source = MutableState.of(0);

      const state = MutableState.of(1);

      const value = mapClosure(state, (current) => current);

      const Once = once((inputs: { source: IReadableClosure<number> }) => {
        const output = useSwitchMap(inputs.source, () => D(value));

        expectTypeOf(output).toEqualTypeOf<IReadableClosure<IReadableClosure<number>>>();

        return output;
      });

      class Class extends BaseStateClosure<
        IReadableClosure<number>,
        { source: IReadableClosure<number> }
      > {
        protected render() {
          const output = this.switchMap(this.inputs.source, () => D(value));

          expectTypeOf(output).toEqualTypeOf<IReadableClosure<IReadableClosure<number>>>();

          return output;
        }
      }

      const output =
        api === 'hook' ? render(S([Once, { source }])) : render(S([Class, { source }]));

      expect(output.value.value).toBe(value);

      source.next(1);

      expect(output.value.value).toBe(value);

      output.destroy();

      state.next(2);

      expect(value.value.value).toBe(2);

      expect(value.value.closed).toBe(false);

      value.destroy();

      source.destroy();

      state.destroy();
    },
  );

  test('builds lazily and does not repeat the initial mapping on subscription', () => {
    const source = MutableState.of(1);

    const mapper = jest.fn((value: number) => D(value * 2));

    const output = switchMapClosure(source, mapper);

    expect(mapper).not.toHaveBeenCalled();

    expect(output.value.value).toBe(2);

    expect(mapper).toHaveBeenCalledTimes(1);
    expect(mapper).toHaveBeenCalledWith(1);

    output.value.subscribe(() => {});

    source.next(1);

    expect(mapper).toHaveBeenCalledTimes(1);

    output.destroy();

    const unused = switchMapClosure(source, mapper);

    unused.destroy();

    expect(mapper).toHaveBeenCalledTimes(1);

    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('replaces owned child graphs and stops observing previous inner values', () => {
    const source = MutableState.of(0);

    const values = [MutableState.of(1), MutableState.of(2)];

    const cleaned = jest.fn();

    const Child = once(({ index }: { index: number }) => {
      useClearable(() => cleaned(index));

      return values[index];
    });

    const output = switchMapClosure(source, (index) => S([Child, { index: D(index) }]));

    expect(output.value.value).toBe(1);

    source.next(1);

    expect(output.value.value).toBe(2);

    expect(cleaned).toHaveBeenCalledTimes(1);
    expect(cleaned).toHaveBeenCalledWith(0);

    values[0].next(3);

    expect(output.value.value).toBe(2);

    values[1].next(4);

    expect(output.value.value).toBe(4);

    output.destroy();

    output.destroy();

    expect(cleaned.mock.calls).toEqual([[0], [1]]);

    expect(values.every((value) => !value.closed)).toBe(true);

    source.destroy();

    values.forEach((value) => value.destroy());
  });

  test('keeps shared closures alive when the next child or another graph owns them', () => {
    const source = MutableState.of(0);

    const value = MutableState.of(1);

    const child = mapClosure(value, (current) => current);

    const other = mapClosure(child, (current) => current);

    const output = switchMapClosure(source, () => child);

    expect(output.value.value).toBe(1);

    expect(other.value.value).toBe(1);

    source.next(1);

    expect(child.value.closed).toBe(false);

    output.destroy();

    value.next(2);

    expect(other.value.value).toBe(2);

    other.destroy();

    expect(child.value.closed).toBe(true);

    expect(value.closed).toBe(false);

    source.destroy();

    value.destroy();
  });

  test('waits for the current inner after the outer source completes', () => {
    const source = MutableState.of(1);

    const value = MutableState.of(2);

    const output = switchMapClosure(source, () => value);

    const complete = jest.fn();

    output.value.subscribe({ complete });

    source.complete();

    expect(output.value.closed).toBe(false);

    value.next(3);

    expect(output.value.value).toBe(3);

    value.complete();

    expect(output.value.closed).toBe(true);

    expect(complete).toHaveBeenCalledTimes(1);

    output.destroy();
  });

  test('reads completed outer and inner values when first initialized', () => {
    const output = switchMapClosure(ReactiveState.of(2), (value) => ReactiveState.of(value * 3));

    expect(output.value.value).toBe(6);

    expect(output.value.closed).toBe(true);

    output.destroy();
  });

  test('retains the final completed child until its owner is destroyed', () => {
    const source = MutableState.of(true);

    const cleaned = jest.fn();

    const Child = once(() => {
      useClearable(cleaned);

      return ReactiveState.of(1);
    });

    const output = switchMapClosure(source, (enabled) => (enabled ? S([Child, {}]) : null));

    expect(output.value.value).toBe(1);

    source.next(false);

    expect(output.value.value).toBe(null);

    expect(cleaned).toHaveBeenCalledTimes(1);

    source.next(true);

    expect(output.value.value).toBe(1);

    source.complete();

    expect(output.value.closed).toBe(true);

    expect(cleaned).toHaveBeenCalledTimes(1);

    output.destroy();

    expect(cleaned).toHaveBeenCalledTimes(2);
  });

  test('keeps lazy closures in a completed value readable until the output is destroyed', () => {
    const initialized = jest.fn();

    const cleaned = jest.fn();

    const Lazy = once(() => {
      initialized();

      useClearable(cleaned);

      return ReactiveState.of(42);
    });

    const Child = once(() => {
      const item = useCreate(S([Lazy, {}]));

      return ReactiveState.of([item]);
    });

    const output = switchMapClosure(ReactiveState.of(true), () => S([Child, {}]));

    expect(output.value.closed).toBe(true);

    expect(initialized).not.toHaveBeenCalled();

    const [item] = output.value.value;

    expect(item?.value.value).toBe(42);

    expect(initialized).toHaveBeenCalledTimes(1);

    expect(cleaned).not.toHaveBeenCalled();

    output.destroy();

    expect(cleaned).toHaveBeenCalledTimes(1);
  });

  test('settles source replacement and pending inner changes in one batched output', () => {
    const source = MutableState.of(0);

    const first = MutableState.of(1);

    const second = MutableState.of(2);

    const output = switchMapClosure(source, (index) => (index === 0 ? first : second));

    const next = jest.fn();

    output.value.subscribe(next);

    next.mockClear();

    BatchScheduler.batch(() => {
      first.next(3);

      source.next(1);

      second.next(4);
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(4);

    output.destroy();

    source.destroy();

    first.destroy();

    second.destroy();
  });

  test('reads pending outer and inner values on first access', () => {
    const source = MutableState.of(0);

    const value = MutableState.of(2);

    const output = switchMapClosure(source, (index) => (index === 0 ? D(0) : value));

    BatchScheduler.batch(() => {
      source.next(1);

      value.next(3);

      expect(output.value.value).toBe(3);
    });

    BatchScheduler.setPriority(value, 20);

    expect(BatchScheduler.getPriority(output.value)).toBeGreaterThan(20);

    output.destroy();

    source.destroy();

    value.destroy();
  });

  test('retains immediate state values without subscribing to or owning them', () => {
    const value = MutableState.of(1);

    const output = switchMapClosure(0, () => D(value));

    expectTypeOf(output).toEqualTypeOf<IReadableClosure<MutableState<number>>>();

    expect(output.value.value).toBe(value);

    expect(output.value.closed).toBe(true);

    output.destroy();

    expect(value.closed).toBe(false);

    value.destroy();
  });

  test('renders changing descriptor lists and keeps their raw states borrowed', () => {
    const first = MutableState.of(1);

    const second = MutableState.of(2);

    const source = MutableState.of([first]);

    const output = switchMapClosure(source, (items) => items, shallowEqual);

    expectTypeOf(output).toEqualTypeOf<IReadableClosure<number[]>>();

    expect(output.value.value).toEqual([1]);

    BatchScheduler.batch(() => {
      source.next([first, second]);

      first.next(3);

      second.next(4);
    });

    expect(output.value.value).toEqual([3, 4]);

    source.next([]);

    expect(output.value.value).toEqual([]);

    expect(first.closed).toBe(false);

    expect(second.closed).toBe(false);

    source.complete();

    expect(output.value.closed).toBe(true);

    output.destroy();

    first.destroy();

    second.destroy();
  });

  test('waits for newly selected derived dependencies before notifying downstream consumers', () => {
    const source = MutableState.of(false);

    const value = MutableState.of(1);

    const first = mapClosure(value, (current) => current * 2);

    const second = mapClosure(first, (current) => current + 1);

    const output = switchMapClosure(source, (selected) => (selected ? second : D(0)));

    const next = jest.fn();

    output.value.subscribe(next);

    next.mockClear();

    BatchScheduler.batch(() => {
      source.next(true);

      value.next(2);
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(5);

    BatchScheduler.setPriority(value, 20);

    expect(BatchScheduler.getPriority(output.value)).toBeGreaterThan(20);

    output.destroy();

    source.destroy();

    value.destroy();
  });

  test('publishes the final replacement before completing an atomic source change', () => {
    const source = MutableState.of(false);

    const value = MutableState.of(1);

    const output = switchMapClosure(source, (selected) => (selected ? value : D(0)));

    const events: Array<number | 'complete'> = [];

    output.value.subscribe({
      next: (current) => events.push(current),

      complete: () => events.push('complete'),
    });

    BatchScheduler.batch(() => {
      source.next(true);

      source.complete();

      value.next(2);

      value.complete();
    });

    expect(events).toEqual([0, 2, 'complete']);

    output.destroy();
  });

  test('supports result comparison across replacements', () => {
    const source = MutableState.of(1);

    const output = switchMapClosure(source, (value) => D({ parity: value % 2 }), shallowEqual);

    const next = jest.fn();

    output.value.subscribe(next);

    next.mockClear();

    source.next(3);

    expect(next).not.toHaveBeenCalled();

    source.next(4);

    expect(output.value.value).toEqual({ parity: 0 });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ parity: 0 });

    output.destroy();

    source.destroy();
  });

  test.each(['initial', 'replacement'] as const)(
    'releases resources after %s construction fails',
    (stage) => {
      const source = MutableState.of(stage === 'initial' ? 1 : 0);

      const cleaned = jest.fn();

      const failure = new Error('Cannot initialize child.');

      const Child = once(({ value }: { value: number }) => {
        useClearable(() => cleaned(value));

        if (value === 1) {
          throw failure;
        }

        return D(value);
      });

      const output = switchMapClosure(source, (value) => S([Child, { value: D(value) }]));

      if (stage === 'initial') {
        expect(() => output.value).toThrow(failure);
      } else {
        const error = jest.fn();

        output.value.subscribe({ error });

        source.next(1);

        expect(error).toHaveBeenCalledTimes(1);
        expect(error).toHaveBeenCalledWith(failure);
      }

      output.destroy();

      expect(cleaned.mock.calls).toEqual(stage === 'initial' ? [[1]] : [[1], [0]]);

      expect(source.closed).toBe(false);

      source.destroy();
    },
  );

  test.each(['outer', 'inner'] as const)(
    'forwards %s errors and releases the active child',
    (target) => {
      const source = MutableState.of(0);

      const value = MutableState.of(1);

      const cleaned = jest.fn();

      const failure = new Error('Source failed.');

      const Child = once(() => {
        useClearable(cleaned);

        return value;
      });

      const output = switchMapClosure(source, () => S([Child, {}]));

      const error = jest.fn();

      output.value.subscribe({ error });

      (target === 'outer' ? source : value).error(failure);

      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(failure);

      expect(cleaned).toHaveBeenCalledTimes(1);

      output.destroy();

      source.destroy();

      value.destroy();
    },
  );

  test('supports once hooks and keeps mapper callbacks outside hook contexts', () => {
    const Parent = once(({ source }: { source: IReadableClosure<number> }) =>
      useSwitchMap(source, (value) => D(value * 2)),
    );

    const output = render(S([Parent, { source: ReactiveState.of(3) }]));

    expectTypeOf(output).toEqualTypeOf<IReadableClosure<number>>();

    expect(output.value.value).toBe(6);

    expect(() => useSwitchMap(1, (value) => D(value))).toThrow(
      'useSwitchMap can only be used in once functions',
    );

    const invalid = switchMapClosure(1, (value) => useMap(value, (current) => current));

    expect(() => invalid.value).toThrow('useMap can only be used in once functions');

    output.destroy();

    invalid.destroy();
  });
});
