import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  BatchScheduler,
  D,
  type IReactiveState,
  type IStateClosure,
  memo,
  MutableState,
  ReactiveState,
  render,
  S,
  type StateClosureRef,
  type StateClosureSource,
  useClearable,
  useCombine,
  useCombineMap,
  useCompose,
  useMap,
  useRef,
  useStableFn,
} from '../../..';

const doubleValue = (value: number) => value * 2;

const preserveValue = (value: number) => value;

describe('functional state closure hooks', () => {
  test('initializes runtime values from the package entry without circular dependencies', () => {
    const source = MutableState.of(1);

    const fixed = ReactiveState.of(2);

    const Doubled = memo(({ value }: { value: number }) => useMap(value, doubleValue));

    const closure = render<number>(S<number>(<Doubled value={source} />));

    expect(fixed.value).toBe(2);

    expect(closure.value.value).toBe(2);

    closure.destroy();

    fixed.destroy();

    source.destroy();
  });

  test('sets up hook state lazily and flattens a returned reactive state', () => {
    const mapper = vi.fn((value: number) => value * 2);

    const component = vi.fn(({ value }: { value: number }) => useMap(value, mapper));

    const Doubled = memo(component);

    const source = MutableState.of(2);

    const closure = render<number>(S<number>(<Doubled value={source} />));

    expect(component).not.toHaveBeenCalled();

    expect(mapper).not.toHaveBeenCalled();

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<number>>();

    expect(closure.value.value).toBe(4);

    expect(component).toHaveBeenCalled();

    expect(mapper).toHaveBeenCalled();

    expect(closure.value.value).toBeTypeOf('number');

    closure.destroy();

    source.destroy();
  });

  test('supports hooks in raw functional descriptors without memo', () => {
    const component = vi.fn((value: number) => useMap(value, doubleValue));

    const source = MutableState.of(2);

    const closure = render(S([component, source]));

    expect(component).not.toHaveBeenCalled();

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<number>>();

    expect(closure.value.value).toBe(4);

    source.next(3);

    expect(closure.value.value).toBe(6);

    closure.destroy();

    source.destroy();
  });

  test('preserves mapped hook identity and previous values across raw prop updates', () => {
    const states: ReactiveState<number>[] = [];

    const mapper = vi.fn((value: number, _prev: [number, number] | null) => value * 10);

    const Tracked = memo(({ value }: { value: number }) => {
      const state = useMap(value, mapper);

      states.push(state);

      return state;
    });

    const source = MutableState.of(1);

    const closure = render<number>(S<number>(<Tracked value={source} />));

    expect(closure.value.value).toBe(10);

    source.next(2);

    expect(closure.value.value).toBe(20);

    source.next(3);

    expect(closure.value.value).toBe(30);

    expect(states.length).toBeGreaterThanOrEqual(3);

    const firstState = states[0];

    expect(firstState).toBeDefined();

    expect(states.every((state) => state === firstState)).toBe(true);

    const secondValueCalls = mapper.mock.calls.filter(([value]) => value === 2);

    const secondValueCall = secondValueCalls[secondValueCalls.length - 1];

    expect(secondValueCall?.[1]).toEqual([1, 10]);

    const thirdValueCalls = mapper.mock.calls.filter(([value]) => value === 3);

    const thirdValueCall = thirdValueCalls[thirdValueCalls.length - 1];

    expect(thirdValueCall?.[1]).toEqual([2, 20]);

    closure.destroy();

    source.destroy();
  });

  test('combines raw values as typed tuples and keeps composed hook states stable', () => {
    const pairs: ReactiveState<[number, string]>[] = [];

    const summaries: ReactiveState<string>[] = [];

    const Summary = memo(({ count, label }: { count: number; label: string }) => {
      const pair = useCombine(count, label);

      const summary = useCombineMap(
        [count, label],
        ([currentCount, currentLabel]) => `${currentLabel}:${currentCount}`,
      );

      expectTypeOf(pair).toEqualTypeOf<ReactiveState<[number, string]>>();

      expectTypeOf(summary).toEqualTypeOf<ReactiveState<string>>();

      pairs.push(pair);

      summaries.push(summary);

      return summary;
    });

    const count = MutableState.of(1);

    const label = MutableState.of('first');

    const closure = render<string>(S<string>(<Summary count={count} label={label} />));

    expect(closure.value.value).toBe('first:1');

    expect(pairs[0]?.value).toEqual([1, 'first']);

    count.next(2);

    expect(closure.value.value).toBe('first:2');

    expect(pairs[0]?.value).toEqual([2, 'first']);

    label.next('second');

    expect(closure.value.value).toBe('second:2');

    expect(pairs[0]?.value).toEqual([2, 'second']);

    const firstPair = pairs[0];

    const firstSummary = summaries[0];

    expect(pairs.every((pair) => pair === firstPair)).toBe(true);

    expect(summaries.every((summary) => summary === firstSummary)).toBe(true);

    closure.destroy();

    count.destroy();

    label.destroy();
  });

  test('cleans replaced clearable targets once and retains the current target until destroy', () => {
    const firstCleanup = vi.fn();

    const secondCleanup = vi.fn();

    const Clearable = memo(({ alternate }: { alternate: boolean }) => {
      const cleanup = alternate ? secondCleanup : firstCleanup;

      expect(useClearable(cleanup)).toBe(cleanup);

      return alternate;
    });

    const alternate = MutableState.of(false);

    const closure = render<boolean>(S<boolean>(<Clearable alternate={alternate} />));

    expect(closure.value.value).toBe(false);

    expect(firstCleanup).not.toHaveBeenCalled();

    expect(secondCleanup).not.toHaveBeenCalled();

    alternate.next(true);

    expect(closure.value.value).toBe(true);

    expect(firstCleanup).toHaveBeenCalledOnce();

    expect(secondCleanup).not.toHaveBeenCalled();

    closure.destroy();

    closure.destroy();

    expect(firstCleanup).toHaveBeenCalledOnce();

    expect(secondCleanup).toHaveBeenCalledOnce();

    alternate.destroy();
  });

  test('rejects every hook outside a functional state closure render', () => {
    const source = MutableState.of(1);

    const cleanup = vi.fn();

    const calls: Array<() => unknown> = [
      () => useMap(1, (value) => value),
      () => useCombineMap([1, 2], ([left, right]) => left + right),
      () => useCombine(1, 2),
      () => useCompose(source),
      () => useClearable(cleanup),
      () => useRef(1),
      () => useStableFn(() => undefined),
    ];

    for (const call of calls) {
      expect(call).toThrowError(/functional state closure/i);
    }

    expect(cleanup).not.toHaveBeenCalled();

    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('keeps refs stable and ignores later initial values', () => {
    const refs: StateClosureRef<number>[] = [];

    const RefValue = memo(({ value }: { value: number }) => {
      const ref = useRef(value);

      refs.push(ref);

      return ref;
    });

    const source = MutableState.of(1);

    const closure = render(S([RefValue, { value: source }]));

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<StateClosureRef<number>>>();

    expect(closure.value.value.current).toBe(1);

    source.next(2);

    expect(closure.value.value.current).toBe(1);

    expect(refs.every((ref) => ref === refs[0])).toBe(true);

    closure.value.value.current = 3;

    expect(refs[0]?.current).toBe(3);

    closure.destroy();

    source.destroy();
  });

  test('keeps stable functions referentially equal while calling the latest implementation', () => {
    const callbacks: Array<(value: number) => number> = [];

    const Callback = memo(({ factor }: { factor: number }) => {
      const callback = useStableFn((value: number) => value * factor);

      callbacks.push(callback);

      return D(callback);
    });

    const factor = MutableState.of(2);

    const closure = render(S([Callback, { factor }]));

    const callback = closure.value.value;

    expect(callback(3)).toBe(6);

    factor.next(4);

    expect(callbacks.every((current) => current === callback)).toBe(true);

    expect(closure.value.value).toBe(callback);

    expect(callback(3)).toBe(12);

    closure.destroy();

    factor.destroy();
  });

  test('isolates hook state between component instances', () => {
    const firstStates: ReactiveState<number>[] = [];

    const secondStates: ReactiveState<number>[] = [];

    const Tracked = memo(({ id, value }: { id: 'first' | 'second'; value: number }) => {
      const state = useMap(value, doubleValue);

      if (id === 'first') {
        firstStates.push(state);
      } else {
        secondStates.push(state);
      }

      return state;
    });

    const firstSource = MutableState.of(1);

    const secondSource = MutableState.of(2);

    const firstClosure = render<number>(S<number>(<Tracked id="first" value={firstSource} />));

    const secondClosure = render<number>(S<number>(<Tracked id="second" value={secondSource} />));

    expect(firstClosure.value.value).toBe(2);

    expect(secondClosure.value.value).toBe(4);

    expect(firstStates[0]).not.toBe(secondStates[0]);

    firstSource.next(3);

    expect(firstClosure.value.value).toBe(6);

    expect(secondClosure.value.value).toBe(4);

    const firstState = firstStates[0];

    const secondState = secondStates[0];

    expect(firstStates.every((state) => state === firstState)).toBe(true);

    expect(secondStates.every((state) => state === secondState)).toBe(true);

    firstClosure.destroy();

    secondSource.next(4);

    expect(secondClosure.value.value).toBe(8);

    secondClosure.destroy();

    firstSource.destroy();

    secondSource.destroy();
  });

  test('rejects conditional changes to hook order', () => {
    const Conditional = memo(({ swapped, value }: { swapped: boolean; value: number }) => {
      if (swapped) {
        useCombine(value);

        return useMap(value, preserveValue);
      }

      const state = useMap(value, preserveValue);

      useCombine(value);

      return state;
    });

    const swapped = MutableState.of(false);

    const value = MutableState.of(1);

    const closure = render<number>(S<number>(<Conditional swapped={swapped} value={value} />));

    expect(closure.value.value).toBe(1);

    expect(() => swapped.next(true)).toThrowError(/hook/i);

    closure.destroy();

    swapped.destroy();

    value.destroy();
  });

  test('composes borrowed reactive sources and flattens directly returned sources', () => {
    const Composed = memo(({ source }: { source: IReactiveState<number> }) => {
      const state = useCompose(source);

      expectTypeOf(state).toEqualTypeOf<IReactiveState<number>>();

      return state;
    });

    const Direct = memo(({ source }: { source: IReactiveState<number> }) => source);

    const source = MutableState.of(1);

    const composedClosure = render<number>(S<number>(<Composed source={D(source)} />));

    const directClosure = render<number>(S<number>(<Direct source={D(source)} />));

    expect(composedClosure.value.value).toBe(1);

    expect(directClosure.value.value).toBe(1);

    source.next(2);

    expect(composedClosure.value.value).toBe(2);

    expect(directClosure.value.value).toBe(2);

    composedClosure.destroy();

    directClosure.destroy();

    expect(source.closed).toBe(false);

    source.next(3);

    expect(source.value).toBe(3);

    source.destroy();
  });

  test('applies a memo distinctor to flattened hook values', () => {
    type Item = {
      group: number;

      value: number;
    };

    const distinctor = vi.fn((left: Item, right: Item) => left.group === right.group);

    const Grouped = memo(
      ({ value }: { value: number }) =>
        useMap(
          value,
          (currentValue): Item => ({
            group: currentValue % 2,
            value: currentValue,
          }),
        ),
      distinctor,
    );

    const source = MutableState.of(1);

    const closure = render<Item>(S<Item>(<Grouped value={source} />));

    const next = vi.fn();

    closure.value.subscribe(next);

    const initial = closure.value.value;

    next.mockClear();

    source.next(3);

    expect(closure.value.value).toBe(initial);

    expect(next).not.toHaveBeenCalled();

    source.next(2);

    expect(closure.value.value).toEqual({ group: 0, value: 2 });

    expect(next).toHaveBeenCalledOnce();

    expect(distinctor).toHaveBeenCalled();

    closure.destroy();

    source.destroy();
  });

  test('types and applies a raw descriptor distinctor to flattened hook values', () => {
    const distinctor = vi.fn((left: number, right: number) => left % 2 === right % 2);

    const source = MutableState.of(1);

    const descriptor = S([
      ({ value }: { value: number }) => useMap(value, preserveValue),
      {
        value: source,
      },
      distinctor,
    ]);

    const closure = render(descriptor);

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<number>>();

    const initial = closure.value.value;

    source.next(3);

    expect(closure.value.value).toBe(initial);

    source.next(2);

    expect(closure.value.value).toBe(2);

    expect(distinctor).toHaveBeenCalled();

    closure.destroy();

    source.destroy();
  });

  test('recomputes mapped hooks with the latest mapper when another prop changes', () => {
    const Mapped = memo(({ factor, value }: { factor: number; value: number }) =>
      useMap(value, (currentValue) => currentValue * factor),
    );

    const factor = MutableState.of(2);

    const value = MutableState.of(3);

    const closure = render<number>(S<number>(<Mapped factor={factor} value={value} />));

    const state = closure.value;

    expect(state.value).toBe(6);

    factor.next(4);

    expect(state.value).toBe(12);

    closure.destroy();

    factor.destroy();

    value.destroy();
  });

  test('rolls back reused hook updates when a render fails', () => {
    const Rendered = memo(({ factor }: { factor: number }) => {
      const state = useMap(1, (value) => value * factor);

      if (factor === 3) {
        throw new Error('render failed');
      }

      return state;
    });

    const factor = MutableState.of(2);

    const closure = render<number>(S<number>(<Rendered factor={factor} />));

    const next = vi.fn();

    closure.value.subscribe(next);

    expect(closure.value.value).toBe(2);

    next.mockClear();

    expect(() => factor.next(3)).toThrowError('render failed');

    expect(closure.value.value).toBe(2);

    expect(next).not.toHaveBeenCalled();

    factor.next(4);

    expect(closure.value.value).toBe(4);

    closure.destroy();

    factor.destroy();
  });

  test('rolls back reused combined hook updates when a render fails', () => {
    const Rendered = memo(({ factor }: { factor: number }) => {
      const state = useCombineMap([1, 2], ([left, right]) => (left + right) * factor);

      if (factor === 3) {
        throw new Error('combined render failed');
      }

      return state;
    });

    const factor = MutableState.of(2);

    const closure = render<number>(S<number>(<Rendered factor={factor} />));

    expect(closure.value.value).toBe(6);

    expect(() => factor.next(3)).toThrowError('combined render failed');

    expect(closure.value.value).toBe(6);

    factor.next(4);

    expect(closure.value.value).toBe(12);

    closure.destroy();

    factor.destroy();
  });

  test('preserves NaN scheduling priority through functional results', () => {
    const Identity = memo(({ value }: { value: number }) => value);

    const source = MutableState.of(1);

    BatchScheduler.setPriority(source, NaN);

    const closure = render<number>(S<number>(<Identity value={source} />));

    expect(BatchScheduler.getPriority(closure.value)).toBeNaN();

    closure.destroy();

    source.destroy();
  });

  test('composes descriptors and destroys every owned result once', () => {
    const destroyChild = vi.fn();

    class ChildStateClosure extends BaseStateClosure<number, { value: number }> {
      protected render() {
        return this.inputs.value;
      }

      override destroy() {
        destroyChild();

        super.destroy();
      }
    }

    const Composed = memo(({ value }: { value: number }) =>
      useCompose(S([ChildStateClosure, { value }])),
    );

    const source = MutableState.of(1);

    const closure = render<number>(S<number>(<Composed value={source} />));

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<number>>();

    expect(closure.value.value).toBe(1);

    source.next(2);

    expect(closure.value.value).toBe(2);

    expect(destroyChild).toHaveBeenCalledTimes(2);

    closure.destroy();

    closure.destroy();

    expect(destroyChild).toHaveBeenCalledTimes(3);

    source.destroy();
  });

  test('renders JSX descriptors returned by functional state closures', () => {
    const Doubled = memo(({ value }: { value: number }) => value * 2);

    const Nested = memo(({ value }: { value: number }) => <Doubled value={value} />);

    const source = MutableState.of(1);

    const closure = render<number>(S<number>(<Nested value={source} />));

    expect(closure.value.value).toBe(2);

    source.next(3);

    expect(closure.value.value).toBe(6);

    closure.destroy();

    source.destroy();
  });

  test('composes unmarked raw descriptors passed explicitly to hooks', () => {
    class ChildStateClosure extends BaseStateClosure<number, { value: number }> {
      protected render() {
        return this.inputs.value;
      }
    }

    const Composed = memo(({ source }: { source: StateClosureSource<number> }) =>
      useCompose(source),
    );

    const descriptor = [ChildStateClosure, { value: 7 }] as const;

    const closure = render<number>(S([Composed, { source: D(descriptor) }]));

    expect(closure.value.value).toBe(7);

    closure.destroy();
  });

  test('preserves D-wrapped returned states as immediate values', () => {
    const Immediate = memo(({ source }: { source: IReactiveState<number> }) => D(source));

    const source = MutableState.of(1);

    const closure = render<IReactiveState<number>>(
      S<IReactiveState<number>>(<Immediate source={D(source)} />),
    );

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<IReactiveState<number>>>();

    expect(closure.value.value).toBe(source);

    source.next(2);

    expect(closure.value.value).toBe(source);

    expect(closure.value.value.value).toBe(2);

    closure.destroy();

    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('preserves raw objects that only resemble state closures', () => {
    const destroy = vi.fn();

    const result = {
      destroy,
      value: undefined,
    };

    const RawObject = memo(() => result);

    const closure = render(S([RawObject, {}]));

    expect(closure.value.value).toBe(result);

    closure.destroy();

    expect(destroy).not.toHaveBeenCalled();
  });

  test('preserves D-wrapped tuples that resemble slotted descriptors', () => {
    class Plugin {
      readonly name = 'plugin';
    }

    const result = [Plugin, { enabled: true }] as const;

    const RawTuple = memo(() => D(result));

    const closure = render(S([RawTuple, {}]));

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<typeof result>>();

    expect(closure.value.value).toBe(result);

    closure.destroy();
  });

  test('preserves unmarked tuple results from functional state closures', () => {
    class FirstPlugin {
      readonly key = 'first';
    }

    class SecondPlugin {
      readonly key = 'second';
    }

    const result = [FirstPlugin, SecondPlugin] as const;

    const PluginList = memo(() => result);

    const closure = render(S([PluginList, {}]));

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<typeof result>>();

    expect(closure.value.value).toBe(result);

    closure.destroy();
  });

  test('completes raw hook graphs with their functional inputs', () => {
    const Doubled = memo(({ value }: { value: number }) => useMap(value, doubleValue));

    const source = MutableState.of(1);

    const closure = render<number>(S<number>(<Doubled value={source} />));

    const complete = vi.fn();

    closure.value.subscribe({ complete });

    source.complete();

    expect(closure.value.closed).toBe(true);

    expect(complete).toHaveBeenCalledOnce();

    closure.destroy();

    source.destroy();
  });

  test('switches useCompose descriptors without destroying borrowed closures', () => {
    const destroyOwned = vi.fn();

    const destroyExternal = vi.fn();

    class OwnedStateClosure extends BaseStateClosure<number> {
      protected render() {
        return 1;
      }

      override destroy() {
        destroyOwned();

        super.destroy();
      }
    }

    class ExternalStateClosure extends BaseStateClosure<number> {
      protected render() {
        return 2;
      }

      override destroy() {
        destroyExternal();

        super.destroy();
      }
    }

    const Composed = memo(({ source }: { source: StateClosureSource<number> }) =>
      useCompose(source),
    );

    const external = new ExternalStateClosure();

    const source = MutableState.of<StateClosureSource<number>>(OwnedStateClosure);

    const closure = render<number>(S([Composed, { source }]));

    expect(closure.value.value).toBe(1);

    source.next(external);

    expect(closure.value.value).toBe(2);

    expect(destroyOwned).toHaveBeenCalledOnce();

    expect(destroyExternal).not.toHaveBeenCalled();

    closure.destroy();

    expect(destroyOwned).toHaveBeenCalledOnce();

    expect(destroyExternal).not.toHaveBeenCalled();

    external.destroy();

    expect(destroyExternal).toHaveBeenCalledOnce();

    source.destroy();
  });
});
