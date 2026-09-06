/**
 * @jsxImportSource ../../../../..
 */

import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { FlattenedState, IReadableClosure, JSXDescriptor } from '../../../../..';

import {
  BaseStateClosure,
  BatchScheduler,
  MutableState,
  once,
  render,
  S,
  useFlatten,
} from '../../../../..';

type Config = {
  count: number;

  label: string;
};

const Snapshot = (config: Config) => config;

describe('useFlatten', () => {
  test('initializes with its owner and subscribes only to consumed fields', () => {
    const source = MutableState.of<Config>({ count: 1, label: 'first' });

    const subscribe = vi.spyOn(source, 'subscribe');

    const destroy = vi.spyOn(source, 'destroy');

    const build = vi.fn();

    let fields: FlattenedState<Config>;

    const Build = once(() => {
      build();

      fields = useFlatten(source);

      expectTypeOf(fields.count).toEqualTypeOf<IReadableClosure<number>>();

      expectTypeOf(fields.label).toEqualTypeOf<IReadableClosure<string>>();

      expect(subscribe).not.toHaveBeenCalled();

      return fields.count;
    });

    const closure = render(S([Build, {}]));

    const unused = render(S([Build, {}]));

    expect(build).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(1);

    expect(subscribe).toHaveBeenCalledOnce();

    const releaseLabel = vi.spyOn(fields!.label, 'destroy');

    source.next({ count: 2, label: 'second' });

    expect(closure.value.value).toBe(2);

    expect(build).toHaveBeenCalledOnce();

    closure.destroy();

    unused.destroy();

    expect(fields!.count.value.closed).toBe(true);

    expect(releaseLabel).toHaveBeenCalledOnce();

    expect(subscribe.mock.results[0]?.value.closed).toBe(true);

    expect(destroy).not.toHaveBeenCalled();

    source.destroy();
  });

  test('suppresses unchanged field values independently', () => {
    const item = { id: 1 };

    const source = MutableState.of({ count: 1, item });

    const countNext = vi.fn();

    const itemNext = vi.fn();

    const Build = once(() => {
      const fields = useFlatten(source);

      fields.count.value.subscribe(countNext);

      fields.item.value.subscribe(itemNext);

      return fields.count;
    });

    const closure = render(S([Build, {}]));

    expect(closure.value.value).toBe(1);

    source.next({ count: 2, item });

    expect(countNext.mock.calls).toEqual([[1], [2]]);

    expect(itemNext.mock.calls).toEqual([[item]]);

    const replacement = { id: 1 };

    source.next({ count: 2, item: replacement });

    expect(countNext.mock.calls).toEqual([[1], [2]]);

    expect(itemNext.mock.calls).toEqual([[item], [replacement]]);

    closure.destroy();

    source.destroy();
  });

  test('composes fields as typed JSX inputs without intermediate updates', () => {
    const source = MutableState.of<Config>({ count: 1, label: 'first' });

    const Build = once((): JSXDescriptor<Config> => <Snapshot {...useFlatten(source)} />);

    const closure = render(S([Build, {}]));

    const next = vi.fn();

    expectTypeOf(closure.value.value).toEqualTypeOf<Config>();

    closure.value.subscribe(next);

    source.next({ count: 2, label: 'second' });

    BatchScheduler.batch(() => {
      source.next({ count: 3, label: 'third' });

      source.next({ count: 4, label: 'fourth' });
    });

    expect(next.mock.calls).toEqual([
      [{ count: 1, label: 'first' }],
      [{ count: 2, label: 'second' }],
      [{ count: 4, label: 'fourth' }],
    ]);

    closure.destroy();

    source.destroy();
  });

  test('keeps borrowed readable closures alive after releasing its field closures', () => {
    const input = MutableState.of<Config>({ count: 1, label: 'first' });

    const source = render(S([Snapshot, input]));

    const destroy = vi.spyOn(source, 'destroy');

    const Build = once(() => useFlatten(source).count);

    const closure = render(S([Build, {}]));

    expect(closure.value.value).toBe(1);

    closure.destroy();

    expect(destroy).not.toHaveBeenCalled();

    input.next({ count: 2, label: 'second' });

    expect(source.value.value).toEqual({ count: 2, label: 'second' });

    source.destroy();

    input.destroy();
  });

  test('reads a lazy closure only when the containing once function runs', () => {
    const started = vi.fn();

    const source = MutableState.of<Config>({ count: 1, label: 'first' });

    class Source extends BaseStateClosure<Config> {
      protected render() {
        started();

        return source;
      }
    }

    const Build = once(({ config }: { config: IReadableClosure<Config> }) => {
      return useFlatten(config).count;
    });

    const closure = render(S([Build, { config: Source }]));

    expect(started).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(1);

    expect(started).toHaveBeenCalledOnce();

    closure.destroy();

    source.destroy();
  });

  test('rejects calls outside once functions before reading the source', () => {
    const source = MutableState.of({ count: 1 });

    const read = vi.spyOn(source, 'value', 'get');

    expect(() => useFlatten(source)).toThrow('useFlatten can only be used in once functions');

    const closure = render(S([() => useFlatten(source), {}]));

    expect(() => closure.value).toThrow('useFlatten can only be used in once functions');

    expect(read).not.toHaveBeenCalled();

    closure.destroy();

    source.destroy();
  });
});
