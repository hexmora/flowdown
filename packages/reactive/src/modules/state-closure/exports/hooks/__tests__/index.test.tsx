/** @jsxImportSource ../../../../.. */
import { BehaviorSubject } from 'rxjs';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  D,
  type IReadableClosure,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  useClearable,
  useCombineMap,
  useCreate,
  useCurrent,
  useDefaults,
  useDefaultsFalsy,
  useMap,
  useRef,
  useStableFn,
} from '../../../../..';

const Counter = ({ value }: { value: number }) => {
  const count = useRef(0);

  count.current += 1;

  return { value, calls: count.current };
};

describe('state closure hooks', () => {
  test('initializes current values lazily once per rendered closure', () => {
    const source = MutableState.of(1);

    const create = vi.fn(() => new Map<string, number>());

    const Mapper = (value: number) => {
      const entries = useCurrent(create);

      expectTypeOf(entries).toEqualTypeOf<Map<string, number>>();

      entries.set('value', value);

      return entries;
    };

    const first = render(S([Mapper, source]));

    const second = render(S([Mapper, source]));

    const unused = render(S([Mapper, source]));

    expect(create).not.toHaveBeenCalled();

    const initial = first.value.value;

    source.next(2);

    expect(first.value.value).toBe(initial);

    expect(initial.get('value')).toBe(2);

    expect(create).toHaveBeenCalledOnce();

    expect(second.value.value).not.toBe(initial);

    expect(second.value.value.get('value')).toBe(2);

    expect(create).toHaveBeenCalledTimes(2);

    first.destroy();

    second.destroy();

    unused.destroy();

    expect(create).toHaveBeenCalledTimes(2);

    source.destroy();
  });

  test.each([undefined, null, false, 0, ''] as const)(
    'retains a current value of %s without rerunning its initializer',
    (value) => {
      const source = MutableState.of(1);

      const create = vi.fn(() => value);

      const closure = render(S([(_value: number) => useCurrent(create), source]));

      expect(closure.value.value).toBe(value);

      source.next(2);

      expect(closure.value.value).toBe(value);

      expect(create).toHaveBeenCalledOnce();

      closure.destroy();

      source.destroy();
    },
  );

  test('retains function values without calling them', () => {
    const source = MutableState.of(1);

    const callback = vi.fn(() => 'value');

    const create = vi.fn(() => callback);

    const closure = render(S([(_value: number) => useCurrent(create), source]));

    expect(closure.value.value).toBe(callback);

    source.next(2);

    expect(closure.value.value).toBe(callback);

    expect(create).toHaveBeenCalledOnce();

    expect(callback).not.toHaveBeenCalled();

    closure.destroy();

    source.destroy();
  });

  test('keeps hooks outside initializers and restores the surrounding mapper context', () => {
    const source = MutableState.of(1);

    const closure = render(
      S([
        (value: number) => {
          const current = useCurrent(() => {
            expect(() => useRef(0)).toThrow('useRef can only be used in mapper functions');

            return value;
          });

          const next = useCurrent(() => value + 1);

          return [current, next];
        },
        source,
      ]),
    );

    expect(closure.value.value).toEqual([1, 2]);

    closure.destroy();

    source.destroy();
  });

  test('releases owned resources when a current initializer fails', () => {
    const cleanup = vi.fn();

    const failure = new Error('Initialization failed.');

    const closure = render(
      S([
        () => {
          useClearable(cleanup);

          return useCurrent(() => {
            throw failure;
          });
        },
        {},
      ]),
    );

    expect(() => closure.value).toThrow(failure);

    expect(cleanup).toHaveBeenCalledOnce();

    closure.destroy();

    expect(cleanup).toHaveBeenCalledOnce();
  });

  test.each([false, true])('rejects changing the number of current slots from %s', (extra) => {
    const source = MutableState.of(extra);

    const closure = render(
      S([
        (includeExtra: boolean) => {
          useCurrent(() => 0);

          if (includeExtra) {
            useCurrent(() => 1);
          }

          return includeExtra;
        },
        source,
      ]),
    );

    expect(closure.value.value).toBe(extra);

    expect(() => source.next(!extra)).toThrow('same order');

    closure.destroy();

    source.destroy();
  });

  test('distinguishes initialized current values from mutable ref slots', () => {
    const source = MutableState.of(false);

    const closure = render(
      S([(current: boolean) => (current ? useCurrent(() => 0) : useRef(0)), source]),
    );

    expect(closure.value.value).toEqual({ current: 0 });

    expect(() => source.next(true)).toThrow('same order');

    closure.destroy();

    source.destroy();
  });

  test('rejects current initializers in once functions', () => {
    const create = vi.fn(() => 1);

    const Build = once(() => {
      useCurrent(create);

      return ReactiveState.of(1);
    });

    const closure = render(S([Build, {}]));

    expect(() => closure.value).toThrow('useCurrent can only be used in mapper functions');

    expect(create).not.toHaveBeenCalled();

    closure.destroy();
  });

  test('keeps mapper refs across calls and isolates them between rendered closures', () => {
    const source = MutableState.of(1);

    const first = render(<Counter value={source} />);
    const second = render(<Counter value={source} />);

    expect(first.value.value).toEqual({ value: 1, calls: 1 });
    expect(second.value.value).toEqual({ value: 1, calls: 1 });

    source.next(2);

    expect(first.value.value).toEqual({ value: 2, calls: 2 });
    expect(second.value.value).toEqual({ value: 2, calls: 2 });

    first.destroy();
    second.destroy();
    source.destroy();
  });

  test('keeps stable callbacks connected to the latest mapper invocation', () => {
    const source = MutableState.of(1);

    const closure = render(S([(value: number) => useStableFn(() => value), source]));

    const callback = closure.value.value;

    source.next(3);

    expect(closure.value.value).toBe(callback);
    expect(callback()).toBe(3);

    closure.destroy();
    source.destroy();
  });

  test('derives owned readable closures without reading unused dependencies', () => {
    const started = vi.fn();

    class Source extends BaseStateClosure<number> {
      protected render() {
        started();

        return ReactiveState.of(2);
      }
    }

    const Build = once(({ source }: { source: IReadableClosure<number> }) => {
      const mapped = useMap(source, (value) => value * 2);
      const composed = useCreate(source);
      const combined = useCombineMap([mapped, composed], ([left, right]) => left + right);

      expectTypeOf(mapped).toEqualTypeOf<IReadableClosure<number>>();
      expectTypeOf(composed).toEqualTypeOf<IReadableClosure<number>>();
      expectTypeOf(combined).toEqualTypeOf<IReadableClosure<number>>();
      expect(started).not.toHaveBeenCalled();

      return combined;
    });

    const parent = render(S([Build, { source: Source }]));

    expect(started).not.toHaveBeenCalled();
    expect(parent.value.value).toBe(6);
    expect(started).toHaveBeenCalledTimes(1);

    parent.destroy();
  });

  test('detaches composed sources and frees owned descriptor results', () => {
    const source = new BehaviorSubject(2);
    const cleaned = vi.fn();

    const Child = once(({ value }: { value: IReadableClosure<number> }) => {
      useClearable(cleaned);

      return value;
    });

    const Parent = once(() => useCreate(<Child value={source} />));

    const closure = render(S([Parent, {}]));

    expect(closure.value.value).toBe(2);

    source.next(3);

    expect(closure.value.value).toBe(3);

    closure.destroy();

    expect(cleaned).toHaveBeenCalledTimes(1);
    expect(source.observed).toBe(false);
    expect(source.isStopped).toBe(false);

    source.complete();
  });

  test('creates concrete class descriptors without losing their instance API', () => {
    const source = new BehaviorSubject(2);
    const started = vi.fn();

    class Item extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
      readonly label = 'item';

      protected render() {
        const { source: input } = this.inputs;

        started();

        return input;
      }
    }

    let item: Item;

    const Build = once(({ value }: { value: IReadableClosure<number> }) => {
      item = useCreate(S([Item, { source: value }]));

      expectTypeOf(item).toEqualTypeOf<Item>();
      expect(useCreate(item)).toBe(item);
      expect(item.label).toBe('item');
      expect(started).not.toHaveBeenCalled();

      return item;
    });

    const closure = render(S([Build, { value: source }]));

    expect(closure.value.value).toBe(2);
    expect(item!).toBeInstanceOf(Item);
    expect(started).toHaveBeenCalledOnce();

    closure.destroy();

    expect(item!.value.closed).toBe(true);
    expect(source.observed).toBe(false);

    source.complete();
  });

  test('defaults select optional closure references without reading values or constructing unused fallbacks', () => {
    const started = vi.fn();
    const constructed = vi.fn();
    const source = new ReactiveState({ initial: 0, emitter: started });

    class Fallback extends BaseStateClosure<number> {
      constructor() {
        super();

        constructed();
      }

      protected render() {
        return ReactiveState.of(9);
      }
    }

    const Build = once(({ value }: { value: IReadableClosure<number> }) => {
      const selected = useDefaults(value, Fallback);
      const truthy = useDefaultsFalsy(value, Fallback);

      expect(selected).toBe(value);
      expect(truthy).toBe(value);
      expect(started).not.toHaveBeenCalled();
      expect(constructed).not.toHaveBeenCalled();

      return selected;
    });

    const closure = render(S([Build, { value: source }]));

    expect(closure.value.value).toBe(0);
    expect(constructed).not.toHaveBeenCalled();

    closure.destroy();
    source.destroy();
  });

  test('defaults construct only the selected fallback and keep its render lazy', () => {
    const started = vi.fn();

    class Fallback extends BaseStateClosure<number> {
      protected render() {
        started();

        return ReactiveState.of(9);
      }
    }

    const Build = once(() => {
      const fallback = useDefaults(undefined, Fallback);

      expectTypeOf(fallback).toEqualTypeOf<IReadableClosure<number>>();
      expect(started).not.toHaveBeenCalled();

      return fallback;
    });

    const closure = render(S([Build, {}]));

    expect(closure.value.value).toBe(9);
    expect(started).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test.each([undefined, null, false, 0, '', 0n] as const)(
    'uses the falsy fallback when the closure reference is %s',
    (value) => {
      const Build = once(() => useDefaultsFalsy(value, 7));
      const closure = render(S([Build, {}]));

      expect(closure.value.value).toBe(7);

      closure.destroy();
    },
  );

  test('releases replaced mapper resources and the final resource on destruction', () => {
    const source = MutableState.of(0);
    const cleanups = [vi.fn(), vi.fn()];

    const closure = render(
      S([
        (value: number) => {
          useClearable(cleanups[value]);

          return value;
        },
        source,
      ]),
    );

    expect(closure.value.value).toBe(0);

    source.next(1);

    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(cleanups[1]).not.toHaveBeenCalled();

    closure.destroy();

    expect(cleanups[1]).toHaveBeenCalledTimes(1);

    source.destroy();
  });

  test.each([
    ['useMap', () => useMap(1, (value) => value), 'once'],
    ['useCreate', () => useCreate(1), 'once'],
    ['useCombineMap', () => useCombineMap([1, 2], ([a, b]) => a + b), 'once'],
    ['useDefaults', () => useDefaults(undefined, 1), 'once'],
    ['useDefaultsFalsy', () => useDefaultsFalsy(false, 1), 'once'],
    ['useRef', () => useRef(1), 'mapper'],
    ['useCurrent', () => useCurrent(() => 1), 'mapper'],
    ['useClearable', () => useClearable(() => {}), 'mapper or once'],
  ] as const)('rejects %s outside its supported function context', (name, hook, usage) => {
    expect(hook).toThrow(`${name} can only be used in ${usage} functions`);
  });

  test('rejects derived hooks in mappers and useRef in once functions', () => {
    const mapper = render(S([() => useMap(1, (value) => value), {}]));

    expect(() => mapper.value).toThrow('useMap can only be used in once functions');

    const Once = once(() => {
      useRef(1);

      return ReactiveState.of(1);
    });

    const closure = render(S([Once, {}]));

    expect(() => closure.value).toThrow('useRef can only be used in mapper functions');

    mapper.destroy();
    closure.destroy();
  });

  test('blocks hooks in class constructors and render even inside an active once function', () => {
    class InConstructor extends BaseStateClosure<number> {
      constructor() {
        super();

        useMap(1, (value) => value);
      }

      protected render() {
        return ReactiveState.of(1);
      }
    }

    class InRender extends BaseStateClosure<number> {
      protected render() {
        useMap(1, (value) => value);

        return ReactiveState.of(1);
      }
    }

    const Construct = once(() => {
      render(InConstructor);

      return ReactiveState.of(1);
    });

    const Read = once(() => {
      const child = useCreate(InRender);

      void child.value;

      return child;
    });

    const construct = render(S([Construct, {}]));
    const read = render(S([Read, {}]));

    expect(() => construct.value).toThrow('hooks cannot be used in classes');
    expect(() => read.value).toThrow('hooks cannot be used in classes');

    construct.destroy();
    read.destroy();
  });

  test('rejects hook order changes and releases resources after failed initialization', () => {
    const cleanup = vi.fn();

    const Broken = once(() => {
      useClearable(cleanup);

      throw new Error('build failed');
    });

    const closure = render(S([Broken, {}]));

    expect(() => closure.value).toThrow('build failed');
    expect(cleanup).toHaveBeenCalledTimes(1);

    closure.destroy();

    expect(cleanup).toHaveBeenCalledTimes(1);

    const source = MutableState.of(false);

    const mapper = render(
      S([
        (extra: boolean) => {
          useRef(0);

          if (extra) {
            useRef(1);
          }

          return extra;
        },
        source,
      ]),
    );

    expect(mapper.value.value).toBe(false);

    expect(() => source.next(true)).toThrow('same order');

    mapper.destroy();
    source.destroy();
  });

  test('preserves mapper results as plain values', () => {
    const source = MutableState.of(1);
    const tuple = [(value: number) => value, 3] as const;

    const stateValue = render(S([() => source, {}]));
    const tupleValue = render(S([() => tuple, {}]));
    const descriptorValue = render(S([() => D(source), {}]));

    expect(stateValue.value.value).toBe(source);
    expect(tupleValue.value.value).toBe(tuple);
    expect(descriptorValue.value.value).not.toBe(source);

    stateValue.destroy();
    tupleValue.destroy();
    descriptorValue.destroy();

    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('releases all hook resources even when a cleanup throws', () => {
    const cleanup = vi.fn();

    const Build = once(() => {
      useClearable(() => {
        throw new Error('cleanup failed');
      });

      useClearable(cleanup);

      return ReactiveState.of(1);
    });

    const closure = render(S([Build, {}]));

    expect(closure.value.value).toBe(1);
    expect(() => closure.destroy()).toThrow('cleanup failed');
    expect(cleanup).toHaveBeenCalledTimes(1);

    closure.destroy();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  test('shares readable resources registered through useClearable', () => {
    const source = new BehaviorSubject(1);

    const shared = render(S([(value: number) => value, source]));

    const Build = once(() => {
      useClearable(shared);

      return ReactiveState.of(0);
    });

    const first = render(S([Build, {}]));
    const second = render(S([Build, {}]));

    expect(first.value.value).toBe(0);
    expect(second.value.value).toBe(0);
    expect(shared.value.value).toBe(1);

    first.destroy();

    source.next(2);

    expect(shared.value.value).toBe(2);

    second.destroy();

    expect(source.observed).toBe(false);

    source.complete();
  });
});
