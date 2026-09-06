import { BehaviorSubject } from 'rxjs';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  D,
  type IReadableClosure,
  isReadableClosure,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  toClosure,
  useCreate,
  useMap,
} from '../../../../../..';

const power = (value: number) => value ** 2;

type ScaleInputs = {
  source: IReadableClosure<number>;
  factor: number;
};

class Scale extends BaseStateClosure<number, ScaleInputs> {
  protected render() {
    const { source, factor } = this.inputs;

    return this.map(source, (value) => value * factor);
  }
}

describe('descriptor construction', () => {
  test('renders null directly and from once and class declarations', () => {
    const factory = vi.fn(() => null);
    const NullOnce = once(factory);

    class NullClass extends BaseStateClosure<null> {
      protected render() {
        return null;
      }
    }

    const direct = render(null);
    const functional = render(S([NullOnce, {}]));
    const instance = render(NullClass);

    expect(factory).not.toHaveBeenCalled();

    for (const closure of [direct, functional, instance]) {
      expect(isReadableClosure(closure)).toBe(true);
      expect(closure.value.value).toBe(null);

      closure.destroy();

      expect(closure.value.closed).toBe(true);
    }

    expect(factory).toHaveBeenCalledOnce();
  });

  test('keeps S identity and preserves class instances', () => {
    const descriptor = [Scale, { source: ReactiveState.of(2), factor: 3 }] as const;
    const marked = S(descriptor);

    expect(marked).toBe(descriptor);
    expect(S(marked)).toBe(descriptor);
    expect(Object.keys(marked)).toEqual(['0', '1']);
    expect(Object.getOwnPropertySymbols({ ...marked })).toEqual([]);

    const closure = render(marked);

    expectTypeOf(closure).toEqualTypeOf<Scale>();
    expect(closure).toBeInstanceOf(Scale);
    expect(render(closure)).toBe(closure);
    expect(closure.inputs.factor).toBe(3);
    expect(isReadableClosure(closure.inputs.source)).toBe(true);
    expect(closure.value.value).toBe(6);

    closure.destroy();
  });

  test('does not interpret inherited descriptor markers on ordinary arrays', () => {
    const mapper = vi.fn((value: number) => value * 2);
    const descriptor = S([mapper, 1]);
    const values: unknown[] = [mapper, 2];

    Object.setPrototypeOf(values, descriptor);

    const Receive = once(({ items }: { items: IReadableClosure<unknown[]> }) => items);
    const closure = render(S([Receive, { items: values }]));

    expect(closure.value.value).toBe(values);
    expect(mapper).not.toHaveBeenCalled();

    closure.destroy();
  });

  test('renders zero-argument classes and unmarked descriptors', () => {
    class Constant extends BaseStateClosure<number> {
      protected render() {
        return ReactiveState.of(3);
      }
    }

    const first = render(Constant);
    const second = render([Scale, { source: first, factor: D(2) }] as const);

    expect(second.value.value).toBe(6);

    second.destroy();

    expect(first.value.closed).toBe(true);
  });

  test('keeps unopened mapper and once dependencies lazy', () => {
    const subscribe = vi.fn();

    const source = new ReactiveState({ initial: 1, emitter: subscribe });
    const mapper = vi.fn((value: number) => value * 2);
    const build = vi.fn(({ value }: { value: IReadableClosure<number> }) => value);
    const Once = once(build);
    const mapperClosure = render(S([mapper, source]));
    const onceClosure = render(S([Once, { value: source }]));

    mapperClosure.destroy();
    onceClosure.destroy();

    expect(mapper).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(() => mapperClosure.value).toThrow('destroyed state closure');
  });

  test('does not read value getters when recognizing readable inputs', () => {
    const read = vi.fn(() => ReactiveState.of(1));
    const destroy = vi.fn();

    const child: IReadableClosure<number> = {
      get value() {
        return read();
      },
      destroy,
    };

    const Ignore = once((_props: { child: IReadableClosure<number> }) => ReactiveState.of(2));
    const closure = render(S([Ignore, { child }]));

    expect(isReadableClosure(child)).toBe(true);
    expect(closure.value.value).toBe(2);
    expect(read).not.toHaveBeenCalled();

    closure.destroy();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
  });

  test('retains shared inputs until all owners release them', () => {
    const source = new BehaviorSubject(2);
    const cleaned = vi.fn();

    class Shared extends BaseStateClosure<number> {
      protected render() {
        this.clearable(cleaned);

        return source;
      }
    }

    const child = render(Shared);
    const first = render(S([Scale, { source: child, factor: D(2) }]));
    const second = render(S([Scale, { source: child, factor: D(3) }]));

    expect(first.value.value).toBe(4);
    expect(second.value.value).toBe(6);

    first.destroy();

    expect(cleaned).not.toHaveBeenCalled();

    source.next(4);

    expect(second.value.value).toBe(12);

    second.destroy();

    expect(cleaned).toHaveBeenCalledTimes(1);
    expect(source.observed).toBe(false);
    expect(source.isStopped).toBe(false);

    source.complete();
  });

  test('keeps ownership independent for custom readables inheriting from another readable', () => {
    const originalDestroy = vi.fn();
    const inheritedDestroy = vi.fn();
    const original: IReadableClosure<number> = {
      value: ReactiveState.of(1),
      destroy: originalDestroy,
    };
    const Ignore = once((_inputs: { child: IReadableClosure<number> }) => ReactiveState.of(0));
    const first = render(S([Ignore, { child: original }]));
    const inherited: IReadableClosure<number> = Object.create(original);

    inherited.destroy = inheritedDestroy;

    const second = render(S([Ignore, { child: inherited }]));

    first.destroy();

    expect(originalDestroy).toHaveBeenCalledOnce();
    expect(inheritedDestroy).not.toHaveBeenCalled();
    expect(second.value.value).toBe(0);

    second.destroy();

    expect(originalDestroy).toHaveBeenCalledOnce();
    expect(inheritedDestroy).toHaveBeenCalledOnce();
  });

  test('retains a closure passed from its owner into a deeper independent owner', () => {
    const source = new BehaviorSubject(2);
    let child: IReadableClosure<number>;

    const Parent = once(() => {
      child = useCreate(source);

      return child;
    });

    const parent = render(S([Parent, {}]));

    expect(parent.value.value).toBe(2);

    const deeper = render(S([Scale, { source: child!, factor: D(4) }]));

    parent.destroy();

    expect(deeper.value.value).toBe(8);

    source.next(3);

    expect(deeper.value.value).toBe(12);

    deeper.destroy();

    expect(source.observed).toBe(false);

    source.complete();
  });

  test('detaches each wrapper without destroying a shared external source', () => {
    const source = new BehaviorSubject(1);
    const first = render(S([Scale, { source, factor: D(2) }]));
    const second = render(S([Scale, { source, factor: D(3) }]));

    expect(first.value.value).toBe(2);
    expect(second.value.value).toBe(3);

    first.destroy();

    source.next(2);

    expect(first.value.value).toBe(2);
    expect(second.value.value).toBe(6);

    second.destroy();

    expect(source.observed).toBe(false);
    expect(source.isStopped).toBe(false);

    source.complete();
  });

  test('lets classes release generated results when dynamic children are removed', () => {
    const source = new BehaviorSubject(1);

    class Parent extends BaseStateClosure<number, { create: () => IReadableClosure<number> }> {
      private current: IReadableClosure<number> | null = null;

      protected render() {
        const { create } = this.inputs;

        this.current = create();

        return this.current;
      }

      remove() {
        this.release(this.current!);
      }
    }

    const parent = render(S([Parent, { create: () => source }]));

    expect(parent.value.value).toBe(1);

    parent.remove();

    expect(source.observed).toBe(false);
    expect(source.isStopped).toBe(false);

    parent.destroy();
    source.complete();
  });

  test('passes generator parameters unchanged and only resolves their return value', () => {
    const params = { count: 3, state: MutableState.of(4) };
    const generate = vi.fn((input: typeof params) =>
      S([
        ({ left, right }: { left: number; right: number }) => left + right,
        { left: input.count, right: input.state },
      ]),
    );

    class Parent extends BaseStateClosure<
      number,
      {
        create: (input: typeof params) => IReadableClosure<number>;
      }
    > {
      protected render() {
        const { create } = this.inputs;

        return create(params);
      }
    }

    const closure = render(S([Parent, { create: generate }]));

    expect(generate).not.toHaveBeenCalled();
    expect(closure.value.value).toBe(7);
    expect(generate.mock.calls[0][0]).toBe(params);

    params.state.next(5);

    expect(closure.value.value).toBe(8);

    closure.destroy();
    params.state.destroy();
  });

  test('preserves static functions, constructors and opaque objects with D', () => {
    class Config {
      readonly factor = 3;
    }

    const config = new Config();

    class Calculate extends BaseStateClosure<
      number,
      {
        power: typeof power;
        Config: typeof Config;
        config: Config;
      }
    > {
      protected render() {
        const { power: calculate, Config: Constructor, config: settings } = this.inputs;

        expect(calculate).toBe(power);
        expect(Constructor).toBe(Config);
        expect(settings).toBe(config);

        return ReactiveState.of(calculate(settings.factor));
      }
    }

    const closure = render(
      S([Calculate, { power: D(power), Config: D(Config), config: D(config) }]),
    );

    expect(closure.value.value).toBe(9);

    closure.destroy();
  });

  test('does not adopt opaque D-wrapped readables in class or once inputs', () => {
    const destroy = vi.fn();
    const opaque: IReadableClosure<number> = { value: ReactiveState.of(1), destroy };
    const factory = vi.fn((_props: { opaque: unknown }) => null);
    const IgnoreOnce = once(factory);

    class Ignore extends BaseStateClosure<null, { opaque: unknown }> {
      protected render() {
        return null;
      }
    }

    const classClosure = render(S([Ignore, { opaque: D(opaque) }]));
    const onceClosure = render(S([IgnoreOnce, { opaque: D(opaque) }]));

    expect(classClosure.inputs.opaque).toBe(opaque);
    expect(classClosure.value.value).toBe(null);
    expect(onceClosure.value.value).toBe(null);
    expect(factory).toHaveBeenCalledWith({ opaque });

    classClosure.destroy();
    onceClosure.destroy();

    expect(destroy).not.toHaveBeenCalled();
  });

  test('cleans constructed inputs if a parent constructor fails', () => {
    const cleaned = vi.fn();

    class Child extends BaseStateClosure<number> {
      constructor() {
        super();

        this.clearable(cleaned);
      }

      protected render() {
        return ReactiveState.of(1);
      }
    }

    class Broken extends BaseStateClosure<number, { child: IReadableClosure<number> }> {
      constructor(inputs: { child: IReadableClosure<number> }) {
        super(inputs);

        throw new Error('construction failed');
      }

      protected render() {
        const { child } = this.inputs;

        return child;
      }
    }

    expect(() => render(S([Broken, { child: Child }]))).toThrow('construction failed');
    expect(cleaned).toHaveBeenCalledTimes(1);
  });

  test('cleans nested generators when construction or lazy rendering fails', () => {
    const cleaned = vi.fn();

    class Child extends BaseStateClosure<number> {
      constructor() {
        super();

        this.clearable(cleaned);
      }

      protected render(): never {
        throw new Error('child failed');
      }
    }

    const Parent = once(({ create }: { create: () => IReadableClosure<number> }) =>
      useMap(create(), (value) => value + 1),
    );

    const closure = render(S([Parent, { create: () => Child }]));

    expect(() => closure.value).toThrow('child failed');
    expect(cleaned).toHaveBeenCalledTimes(1);

    closure.destroy();

    expect(cleaned).toHaveBeenCalledTimes(1);
  });

  test('supports direct readable inputs for manually constructed classes', () => {
    const source = MutableState.of(2);
    const input = toClosure(source);
    const closure = new Scale({ source: input, factor: 3 });

    expect(closure.value.value).toBe(6);

    closure.destroy();

    expect(input.value.closed).toBe(true);
    expect(source.closed).toBe(false);

    source.destroy();
  });
});
