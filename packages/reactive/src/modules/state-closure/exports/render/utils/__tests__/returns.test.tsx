/**
 * @jsxImportSource ../../../../../..
 */

import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  D,
  type IReadableClosure,
  isStateClosureDescriptor,
  jsx,
  type JSXDescriptor,
  MutableState,
  once,
  render,
  S,
  type StateClosureResult,
  type StateClosureResultNode,
  toClosure,
  useClearable,
  useMapEach,
} from '../../../../../..';

const Identity = <T,>({ value }: { value: T }) => value;

const createClass = <T,>(factory: () => StateClosureResult<T>) => {
  return class Result extends BaseStateClosure<T> {
    protected render() {
      return factory();
    }
  };
};

test('distinguishes class descriptor lists from exact two-slot class descriptors', () => {
  const Leaf = createClass(() => D(1));

  const three = [Leaf, Leaf, Leaf] as const;

  const four = [Leaf, Leaf, Leaf, Leaf] as const;

  const threeRoot = render(three);

  const fourRoot = render(four);

  const Three = once(() => three);

  const Four = once(() => four);

  const threeOnce = render(S([Three, {}]));

  const fourOnce = render(S([Four, {}]));

  expectTypeOf(threeRoot).toEqualTypeOf<IReadableClosure<readonly [number, number, number]>>();

  expectTypeOf(fourRoot).toEqualTypeOf<
    IReadableClosure<readonly [number, number, number, number]>
  >();

  expectTypeOf(threeOnce).toEqualTypeOf<IReadableClosure<readonly [number, number, number]>>();

  expectTypeOf(fourOnce).toEqualTypeOf<
    IReadableClosure<readonly [number, number, number, number]>
  >();

  for (const closure of [threeRoot, threeOnce]) {
    expect(closure.value.value).toEqual([1, 1, 1]);

    closure.destroy();
  }

  for (const closure of [fourRoot, fourOnce]) {
    expect(closure.value.value).toEqual([1, 1, 1, 1]);

    closure.destroy();
  }
});

test('keeps wrapped functions in descriptor lists literal', () => {
  const values = [D(Identity<number>), D(2), D(3)] as const;

  const List = once(() => values);

  const closure = render(S([List, {}]));

  expectTypeOf(closure).toEqualTypeOf<
    IReadableClosure<readonly [typeof Identity<number>, number, number]>
  >();

  expect(closure.value.value).toEqual([Identity, 2, 3]);

  closure.destroy();
});

test('resolves exact mapper triples with a comparer or explicit undefined', () => {
  const compared = render([Identity<number>, { value: 2 }, Object.is] as const);

  const plain = render([Identity<number>, { value: 3 }, undefined] as const);

  const Compared = once(() => [Identity<number>, { value: 2 }, Object.is] as const);

  const Plain = once(() => [Identity<number>, { value: 3 }, undefined] as const);

  const comparedOnce = render(S([Compared, {}]));

  const plainOnce = render(S([Plain, {}]));

  expectTypeOf(compared).toEqualTypeOf<IReadableClosure<number>>();

  expectTypeOf(plain).toEqualTypeOf<IReadableClosure<number>>();

  expectTypeOf(comparedOnce).toEqualTypeOf<IReadableClosure<number>>();

  expectTypeOf(plainOnce).toEqualTypeOf<IReadableClosure<number>>();

  for (const closure of [compared, comparedOnce]) {
    expect(closure.value.value).toBe(2);

    closure.destroy();
  }

  for (const closure of [plain, plainOnce]) {
    expect(closure.value.value).toBe(3);

    closure.destroy();
  }
});

describe.each([
  {
    name: 'class',

    create: <T,>(factory: () => StateClosureResult<T> & StateClosureResultNode) => {
      return new (createClass(factory))();
    },
  },
  {
    name: 'once',

    create: <T,>(factory: () => StateClosureResult<T> & StateClosureResultNode) => {
      return render<T>([once(factory), {}]);
    },
  },
])('$name return descriptors', ({ create }) => {
  test('keeps null returns open until destruction', () => {
    const closure = render(create<null>(() => null));

    expect(closure.value.value).toBe(null);

    expect(closure.value.closed).toBe(false);

    closure.destroy();

    expect(closure.value.closed).toBe(true);
  });

  test.each([
    { name: 'tuple', descriptor: [Identity<number>, { value: 2 }] as const },
    { name: 'marked tuple', descriptor: S([Identity<number>, { value: 2 }]) },
    { name: 'JSX', descriptor: <Identity<number> value={2} /> },
    { name: 'immediate', descriptor: D(2) },
    { name: 'primitive', descriptor: 2 },
  ])('resolves a $name descriptor', ({ descriptor }) => {
    const factory = vi.fn(() => descriptor);

    const closure = render(create(factory));

    expect(factory).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(2);

    expect(factory).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('resolves nested lists and objects while keeping D-wrapped data literal', () => {
    const source = MutableState.of(2);

    const child = render(S([Identity<number>, { value: source }]));

    const literal = { child, values: [source] };

    const closure = render(
      create<{
        values: (number | { child: number })[];

        literal: typeof literal;

        empty: never[];
      }>(() => ({
        values: [<Identity<number> value={source} />, { child }],

        literal: D(literal),

        empty: [],
      })),
    );

    expect(closure.value.value).toEqual({
      values: [2, { child: 2 }],

      literal,

      empty: [],
    });

    expect(closure.value.value.literal).toBe(literal);

    source.next(3);

    expect(closure.value.value.values).toEqual([3, { child: 3 }]);

    closure.destroy();

    expect(child.value.closed).toBe(true);

    source.destroy();
  });

  test('preserves a D-wrapped closure without reading, following, or owning it', () => {
    const read = vi.fn(() => MutableState.of(2));

    const destroy = vi.fn();

    const child: IReadableClosure<number> = {
      get value() {
        return read();
      },

      destroy,
    };

    const closure = render(create(() => D(child)));

    expect(closure.value.value).toBe(child);

    expect(read).not.toHaveBeenCalled();

    closure.destroy();

    expect(destroy).not.toHaveBeenCalled();

    expect(read).not.toHaveBeenCalled();
  });

  test('follows an unwrapped child and releases it on destruction', () => {
    const source = MutableState.of(2);

    const child = render(S([Identity<number>, { value: source }]));

    const closure = render(create(() => child));

    expect(closure.value.value).toBe(2);

    source.next(3);

    expect(closure.value.value).toBe(3);

    source.complete();

    expect(closure.value.closed).toBe(true);

    closure.destroy();

    expect(child.value.closed).toBe(true);
  });

  test('leaves emitted descriptor-shaped values unchanged', () => {
    const child = render(S([Identity<number>, { value: 2 }]));

    const value = { child, descriptor: D(child) };

    const source = MutableState.of(value);

    const closure = render(create(() => source));

    expect(closure.value.value).toBe(value);

    closure.destroy();

    expect(child.value.value).toBe(2);

    child.destroy();

    source.destroy();
  });

  test('completes a descriptor tree only after all dependencies complete', () => {
    const first = MutableState.of(1);

    const second = MutableState.of(2);

    const closure = render(create<number[]>(() => [first, second]));

    const complete = vi.fn();

    closure.value.subscribe({ complete });

    first.complete();

    expect(complete).not.toHaveBeenCalled();

    second.next(3);

    expect(closure.value.value).toEqual([1, 3]);

    second.complete();

    expect(complete).toHaveBeenCalledOnce();

    closure.destroy();
  });

  test('releases every constructed dependency when a descriptor tree fails to initialize', () => {
    const cleanup = vi.fn();

    const failure = new Error('Failed to read a child.');

    const Child = once(({ fail }: { fail: boolean }) => {
      useClearable(cleanup);

      if (fail) {
        throw failure;
      }

      return 1;
    });

    const closure = render(create<number[]>(() => [<Child fail={false} />, <Child fail />]));

    expect(() => closure.value).toThrow(failure);

    expect(cleanup).toHaveBeenCalledTimes(2);

    closure.destroy();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test('forwards dependency errors through a descriptor tree', () => {
    const source = MutableState.of(1);

    const closure = render(create<number[]>(() => [source]));

    const error = vi.fn();

    const failure = new Error('Failed to update a child.');

    closure.value.subscribe({ error });

    source.error(failure);

    expect(error).toHaveBeenCalledExactlyOnceWith(failure);

    closure.destroy();
  });
});

test('keeps toClosure data literal instead of resolving it as a return tree', () => {
  const source = MutableState.of(2);

  const value = { source, descriptor: D(source) };

  const closure = toClosure(value);

  expect(closure.value.value).toBe(value);

  closure.destroy();

  expect(source.closed).toBe(false);

  source.destroy();
});

test('renders immediate root descriptors without adopting the wrapped value', () => {
  const source = MutableState.of(2);

  const descriptor = D(source);

  const closure = render(descriptor);

  expectTypeOf(closure).toEqualTypeOf<IReadableClosure<MutableState<number>>>();

  expect(isStateClosureDescriptor(descriptor)).toBe(true);

  expect(closure.value.value).toBe(source);

  closure.destroy();

  expect(source.closed).toBe(false);

  source.destroy();
});

test('keeps explicit ownership when returning an immediate child', () => {
  const source = MutableState.of(2);

  const child = render(S([Identity<number>, { value: source }]));

  const Literal = once(() => D(useClearable(child)));

  const closure = render(S([Literal, {}]));

  expect(closure.value.value).toBe(child);

  expect(child.value.value).toBe(2);

  source.next(3);

  expect(closure.value.value).toBe(child);

  expect(child.value.value).toBe(3);

  closure.destroy();

  expect(child.value.closed).toBe(true);

  source.destroy();
});

test('borrows specialized readable inputs passed through D without reading or destroying them', () => {
  const read = vi.fn(() => MutableState.of(2));

  const destroy = vi.fn();

  const child = {
    get value() {
      return read();
    },

    destroy,

    name: 'child',
  };

  const Borrow = once(({ source }: { source: typeof child }) => D(source));

  const closure = render(S([Borrow, { source: D(child) }]));

  expectTypeOf(closure).toEqualTypeOf<IReadableClosure<typeof child>>();

  expect(closure.value.value).toBe(child);

  expect(read).not.toHaveBeenCalled();

  closure.destroy();

  expect(read).not.toHaveBeenCalled();

  expect(destroy).not.toHaveBeenCalled();
});

test('builds a dynamic list of child descriptors that return owned closures as values', () => {
  const source = MutableState.of([1, 2]);

  const children: IReadableClosure<number>[] = [];

  const Child = once(({ value }: { value: IReadableClosure<number> }) => {
    children.push(value);

    return D(value);
  });

  const List = once(({ items }: { items: IReadableClosure<number[]> }) => {
    return useMapEach(items, (value) => S([Child, { value }]));
  });

  const closure = render(S([List, { items: source }]));

  expectTypeOf(closure).toEqualTypeOf<IReadableClosure<IReadableClosure<number>[]>>();

  const initial = closure.value.value;

  expect(initial.map((item) => item.value.value)).toEqual([1, 2]);

  source.next([3, 4, 5]);

  expect(closure.value.value.slice(0, 2)).toEqual(initial);

  expect(closure.value.value.map((item) => item.value.value)).toEqual([3, 4, 5]);

  source.next([]);

  expect(closure.value.value).toEqual([]);

  expect(children.every((child) => child.value.closed)).toBe(true);

  closure.destroy();

  source.destroy();
});

const _typecheckReturns = () => {
  const source = MutableState.of(2);

  const Class = createClass(() => D(source));

  expectTypeOf(render([Class, undefined])).toEqualTypeOf<InstanceType<typeof Class>>();

  const Literal = once(<T,>({ value }: { value: IReadableClosure<T> }) => D(value));

  const nested = render(S([Literal<number>, { value: source }]));

  expectTypeOf(nested).toEqualTypeOf<IReadableClosure<IReadableClosure<number>>>();

  expectTypeOf(jsx(Literal<number>, { value: source })).toEqualTypeOf<
    JSXDescriptor<IReadableClosure<number>>
  >();

  render<IReadableClosure<number>>([Literal<number>, { value: source }]);

  const Tuple = once(() => [Identity<number>, { value: 2 }] as const);

  expectTypeOf(render(S([Tuple, {}]))).toEqualTypeOf<IReadableClosure<number>>();

  render<number>([Tuple, {}]);

  // @ts-expect-error A wrapped closure is a value, not its emitted number.
  render<number>([Literal<number>, { value: source }]);

  expectTypeOf(render(S([once(() => 2), {}]))).toEqualTypeOf<IReadableClosure<number>>();

  const Nested = once(() => ({
    value: source,

    literal: D(source),

    items: [jsx(Identity<number>, { value: source })],
  }));

  expectTypeOf(render(S([Nested, {}]))).toEqualTypeOf<
    IReadableClosure<{
      value: number;

      literal: MutableState<number>;

      items: number[];
    }>
  >();

  // @ts-expect-error Bare callbacks are not descriptors and must use D.
  once(() => () => 2);

  // @ts-expect-error Mapper triples require a comparer, not a third descriptor value.
  once(() => [Identity<number>, D(2), D(3)] as const);

  // @ts-expect-error Once tuples accept exactly two items and have no comparer.
  once(() => [Literal<number>, { value: source }, undefined] as const);

  // @ts-expect-error Mapper tuples do not accept a fourth item.
  once(() => [Identity<number>, { value: 2 }, Object.is, D(3)] as const);

  interface Block<T> extends IReadableClosure<T> {
    slice(): Block<T>;
  }

  const Borrow = once(<T,>({ source: current }: { source: Block<T> }) => D(current.slice()));

  const block = {} as Block<number>;

  expectTypeOf(render(S([Borrow<number>, { source: D(block) }]))).toEqualTypeOf<
    IReadableClosure<Block<number>>
  >();

  <Borrow<number> source={D(block)} />;
};

test('checks return types without constructing their state flows', () => {
  expectTypeOf(_typecheckReturns).toEqualTypeOf<() => void>();
});
