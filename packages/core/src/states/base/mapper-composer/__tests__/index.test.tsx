/**
 * @jsxImportSource functive
 */

import type { IBlockState } from '@fluxdown/types';

import { PluginPriority } from '@fluxdown/types';
import { expectTypeOf } from 'expect-type';
import {
  BatchScheduler,
  type IReadableClosure,
  type JSXDescriptor,
  MutableState,
  once,
  render,
  toClosure,
  useClearable,
  useCombineMap,
  useMap,
} from 'functive';
import { reverse, sortBy } from 'lodash-es';

import type { MapperInputs, MapperPluggable } from '..';
import type { HastRoot } from '../../../../typings';

import { MapperComposer } from '..';
import { isPluggablesEqual } from '../..';
import { createBlock, observerCount, paragraph } from '../../../../__tests__/smooth/utils';

const setup = (initialMappers: MapperPluggable[]) => {
  const first = createBlock('first', paragraph('first'));

  const second = createBlock('second', paragraph('second'));

  const source = MutableState.of([first.block, second.block]);

  const mappers = MutableState.of(initialMappers);

  const closure = render<IBlockState<HastRoot>[]>(
    <MapperComposer source={source} mappers={mappers} />,
  );

  const destroy = () => {
    closure.destroy();

    mappers.destroy();

    source.destroy();

    for (const item of [first, second]) {
      item.block.destroy();

      item.source.destroy();

      item.meta.destroy();
    }
  };

  return { closure, source, mappers, first: first.block, second: second.block, destroy };
};

const Reverse = once(({ source }: MapperInputs) =>
  useMap(source, (blocks) => reverse([...blocks])),
);

const Take = once(({ source, count }: MapperInputs & { count: number }) =>
  useMap(source, (blocks) => blocks.slice(0, count)),
);

const ReverseJSX = once(({ source }: MapperInputs): JSXDescriptor<IBlockState<HastRoot>[]> => {
  return <Reverse source={source} />;
});

const TakeJSX = once(
  ({ source, count }: MapperInputs & { count: number }): JSXDescriptor<IBlockState<HastRoot>[]> => {
    return <Take source={source} count={count} />;
  },
);

describe('MapperComposer', () => {
  test('composes bare and configured mappers in order and follows source updates', () => {
    const { closure, source, first, second, destroy } = setup([Reverse, [Take, { count: 1 }]]);

    expectTypeOf(closure).toEqualTypeOf<IReadableClosure<IBlockState<HastRoot>[]>>();

    expect(closure.value.value).toEqual([second]);

    source.next([second, first]);

    expect(closure.value.value).toEqual([first]);

    destroy();
  });

  test('orders tuples by priority and preserves declaration order for equal priorities', () => {
    const { closure, mappers, first, second, destroy } = setup([
      Reverse,
      [Take, { count: 1, priority: PluginPriority.High }],
    ]);

    expect(closure.value.value).toEqual([first]);

    mappers.next([Reverse, [Take, { count: 1, priority: PluginPriority.Default }]]);

    expect(closure.value.value).toEqual([second]);

    mappers.next([[Take, { count: 1, priority: 10 }], Reverse]);

    expect(closure.value.value).toEqual([second]);

    destroy();
  });

  test('resolves JSX from bare and configured mappers across reactive chain updates', () => {
    const { closure, source, mappers, first, second, destroy } = setup([
      ReverseJSX,
      [TakeJSX, { count: 1 }],
    ]);

    expect(closure.value.value).toEqual([second]);

    mappers.next([ReverseJSX, [TakeJSX, { count: 2 }]]);

    expect(closure.value.value).toEqual([second, first]);

    source.next([second, first]);

    expect(closure.value.value).toEqual([first, second]);

    mappers.next([[TakeJSX, { count: 1 }], ReverseJSX]);

    expect(closure.value.value).toEqual([second]);

    mappers.next([]);

    expect(closure.value.value).toBe(source.value);

    destroy();

    expect(observerCount(source)).toBe(0);

    expect(observerCount(mappers)).toBe(0);
  });

  test('keeps the unchanged prefix when appending, replacing, removing, and reordering mappers', () => {
    const construct = jest.fn();

    const cleanup = jest.fn();

    const createMapper = (key: string) =>
      once(({ source }: MapperInputs) => {
        construct(key);

        useClearable(() => cleanup(key));

        return source;
      });

    const First = createMapper('first');

    const Second = createMapper('second');

    const Third = createMapper('third');

    const { closure, source, mappers, destroy } = setup([First, Second]);

    expect(construct).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(source.value);

    expect(sortBy(construct.mock.calls.map(([key]) => key))).toEqual(['first', 'second']);

    mappers.next([First, Second, Third]);

    expect(sortBy(construct.mock.calls.map(([key]) => key))).toEqual(['first', 'second', 'third']);

    expect(cleanup).not.toHaveBeenCalled();

    mappers.next([First, Third, Second]);

    expect(sortBy(construct.mock.calls.map(([key]) => key))).toEqual([
      'first',
      'second',
      'second',
      'third',
      'third',
    ]);

    expect(sortBy(cleanup.mock.calls.map(([key]) => key))).toEqual(['second', 'third']);

    mappers.next([First]);

    expect(sortBy(cleanup.mock.calls.map(([key]) => key))).toEqual([
      'second',
      'second',
      'third',
      'third',
    ]);

    expect(construct).toHaveBeenCalledTimes(5);

    mappers.next([]);

    expect(cleanup).toHaveBeenLastCalledWith('first');

    expect(closure.value.value).toBe(source.value);

    expect(observerCount(source)).toBeGreaterThan(0);

    closure.destroy();

    expect(observerCount(source)).toBe(0);

    expect(observerCount(mappers)).toBe(0);

    expect(source.closed).toBe(false);

    expect(mappers.closed).toBe(false);

    expect(cleanup).toHaveBeenCalledTimes(5);

    destroy();
  });

  test('keeps equivalent tuple configs and rebuilds the changed suffix', () => {
    const construct = jest.fn();

    const cleanup = jest.fn();

    const Configured = once(({ source, count }: MapperInputs & { count: number }) => {
      construct(count);

      useClearable(cleanup);

      return useMap(source, (blocks) => blocks.slice(0, count));
    });

    const { closure, mappers, first, second, destroy } = setup([[Configured, { count: 1 }]]);

    expect(closure.value.value).toEqual([first]);

    mappers.next([[Configured, { count: 1 }]]);

    expect(construct).toHaveBeenCalledTimes(1);

    expect(cleanup).not.toHaveBeenCalled();

    mappers.next([[Configured, { count: 2 }]]);

    expect(closure.value.value).toEqual([first, second]);

    expect(construct.mock.calls).toEqual([[1], [2]]);

    expect(cleanup).toHaveBeenCalledTimes(1);

    destroy();

    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  test('updates reactive configuration without rebuilding the mapper', () => {
    const construct = jest.fn();

    const index = MutableState.of(0);

    const indexClosure = toClosure(index);

    const Select = once(
      ({ source, index: selection }: MapperInputs & { index: IReadableClosure<number> }) => {
        construct(selection);

        return useCombineMap([source, selection], ([blocks, currentIndex]) =>
          blocks.slice(currentIndex, currentIndex + 1),
        );
      },
    );

    const { closure, mappers, first, second, destroy } = setup([[Select, { index: indexClosure }]]);

    expect(closure.value.value).toEqual([first]);

    index.next(1);

    mappers.next([[Select, { index: indexClosure }]]);

    expect(closure.value.value).toEqual([second]);

    expect(construct).toHaveBeenCalledTimes(1);

    expect(construct).toHaveBeenCalledWith(indexClosure);

    destroy();

    expect(observerCount(index)).toBe(0);

    expect(index.closed).toBe(false);

    index.destroy();
  });

  test('passes array, object, and callback configuration fields unchanged', () => {
    const labels = ['first'];

    const options = { count: 1 };

    const select = jest.fn((blocks: IBlockState<HastRoot>[], count: number) =>
      blocks.slice(0, count),
    );

    const construct = jest.fn();

    const Configured = once(
      (
        inputs: MapperInputs & {
          labels: string[];
          options: { count: number };
          select: typeof select;
        },
      ) => {
        construct(inputs.labels, inputs.options, inputs.select);

        return useMap(inputs.source, (blocks) => inputs.select(blocks, inputs.options.count));
      },
    );

    const { closure, first, destroy } = setup([[Configured, { labels, options, select }]]);

    expect(closure.value.value).toEqual([first]);

    expect(construct.mock.calls[0]?.[0]).toBe(labels);

    expect(construct.mock.calls[0]?.[1]).toBe(options);

    expect(construct.mock.calls[0]?.[2]).toBe(select);

    expect(select).toHaveBeenCalled();

    destroy();
  });

  test('releases constructed mappers if a later mapper throws', () => {
    const cleanup = jest.fn();

    const First = once(({ source }: MapperInputs) => {
      useClearable(cleanup);

      return source;
    });

    const failure = new Error('Failed to build mapper.');

    const Failed = once((_inputs: MapperInputs): IReadableClosure<IBlockState<HastRoot>[]> => {
      throw failure;
    });

    const { closure, source, mappers, destroy } = setup([First, Failed]);

    expect(() => closure.value).toThrow(failure);

    expect(cleanup).toHaveBeenCalledTimes(1);

    expect(observerCount(source)).toBe(0);

    expect(observerCount(mappers)).toBe(0);

    expect(source.closed).toBe(false);

    expect(mappers.closed).toBe(false);

    destroy();
  });

  test('settles list and source changes in one batched output', () => {
    const { closure, source, mappers, first, second, destroy } = setup([Reverse]);

    const next = jest.fn();

    closure.value.subscribe(next);

    next.mockClear();

    BatchScheduler.batch(() => {
      mappers.next([[Take, { count: 1 }], Reverse]);

      source.next([second, first]);
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith([second]);

    destroy();
  });

  test('compares closure config values by identity without initializing them', () => {
    const read = jest.fn();

    const source = {
      destroy: jest.fn(),
      get value() {
        read();

        throw new Error('The comparer must not initialize config closures.');
      },
    };

    const other = {
      destroy: jest.fn(),
      get value() {
        return source.value;
      },
    };

    expect(isPluggablesEqual([[Take, { source }]], [[Take, { source }]])).toBe(true);

    expect(isPluggablesEqual([[Take, { source }]], [[Take, { source: other }]])).toBe(false);

    expect(read).not.toHaveBeenCalled();
  });
});

const Plain = ({ source }: MapperInputs) => source;

const typecheckMappers = () => {
  const Source = once(({ source }: MapperInputs) => source);

  const WrongSource = once(({ source }: { source: IReadableClosure<string> }) =>
    useMap(source, (): IBlockState<HastRoot>[] => []),
  );

  const MissingSource = once(
    ({ value }: { value: IReadableClosure<IBlockState<HastRoot>[]> }) => value,
  );

  const WrongOutput = once(({ source }: MapperInputs) => useMap(source, (blocks) => blocks.length));

  const WrongJSXOutput = once(({ source }: MapperInputs): JSXDescriptor<number> => {
    return <WrongOutput source={source} />;
  });

  const configured = [Take, { count: 1, priority: PluginPriority.High }] satisfies MapperPluggable<{
    count: number;
  }>;

  const configuredJSX = [TakeJSX, { count: 1 }] satisfies MapperPluggable<{ count: number }>;

  const list = [
    Source,
    configured,
    [Take, { count: 2 }],
    ReverseJSX,
    configuredJSX,
    [TakeJSX, { count: 2 }],
  ] satisfies MapperPluggable[];

  // @ts-expect-error Bare mappers cannot require configuration fields.
  const bare: MapperPluggable = Take;

  // @ts-expect-error Bare JSX mappers cannot require configuration fields.
  const bareJSX: MapperPluggable = TakeJSX;

  // @ts-expect-error Mapper source must contain HAST block states.
  const source: MapperPluggable = [WrongSource, {}];

  // @ts-expect-error Bare mapper source must also contain HAST block states.
  const bareSource: MapperPluggable = WrongSource;

  // @ts-expect-error Configured mapper inputs must include source.
  const missing: MapperPluggable = [MissingSource, {}];

  // @ts-expect-error Mapper output must remain a readable HAST block list.
  const output: MapperPluggable = [WrongOutput, {}];

  // @ts-expect-error Configured JSX mappers must describe HAST block lists.
  const jsxOutput: MapperPluggable = [WrongJSXOutput, {}];

  // @ts-expect-error Bare JSX mappers must also describe HAST block lists.
  const bareJSXOutput: MapperPluggable = WrongJSXOutput;

  // @ts-expect-error Mappers must declare a once state closure.
  const plain: MapperPluggable = Plain;

  // @ts-expect-error Explicit configuration types validate tuple config values.
  const config: MapperPluggable<{ count: number }> = [Take, { count: 'one' }];

  // @ts-expect-error Tuple priority must use the shared numeric priority type.
  const priority: MapperPluggable = [Take, { count: 1, priority: 'high' }];

  // @ts-expect-error Explicit configuration types also validate JSX mapper tuples.
  const jsxConfig: MapperPluggable<{ count: number }> = [TakeJSX, { count: 'one' }];

  return {
    list,
    bare,
    bareJSX,
    source,
    bareSource,
    missing,
    output,
    jsxOutput,
    bareJSXOutput,
    plain,
    config,
    priority,
    jsxConfig,
  };
};

void typecheckMappers;
