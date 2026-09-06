/** @jsxImportSource ../../../../.. */
import { BehaviorSubject } from 'rxjs';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  D,
  type IReadableClosure,
  isOnceFunction,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  useCombineMap,
  useMap,
} from '../../../../..';

const Double = ({ value }: { value: number }) => value * 2;

const calculate = (value: number) => value ** 2;

const Identity = <T,>(inputs: T): T => inputs;

function factory(this: { scale: number }, { value }: { value: number }) {
  return ReactiveState.of(this.scale * value);
}

describe('once', () => {
  test('passes static primitives unchanged through S and JSX for every declaration form', () => {
    type Inputs = {
      text: string;
      count: number;
      enabled: boolean;
      size: bigint;
      key: symbol;
      nullable: null;
      missing: undefined;
    };

    const inputs: Inputs = {
      text: 'value',
      count: 3,
      enabled: false,
      size: 4n,
      key: Symbol('key'),
      nullable: null,
      missing: undefined,
    };

    const Once = once((props: Inputs) => ReactiveState.of(props));

    class Class extends BaseStateClosure<Inputs, Inputs> {
      protected render() {
        const { inputs: props } = this;

        return ReactiveState.of(props);
      }
    }

    const closures = [
      render(S([Identity<Inputs>, inputs])),
      render(S([Once, inputs])),
      render(S([Class, inputs])),
      render(<Identity<Inputs> {...inputs} />),
      render(<Once {...inputs} />),
      render(<Class {...inputs} />),
    ];

    for (const closure of closures) {
      expect(closure.value.value).toEqual(inputs);

      closure.destroy();
    }
  });

  test('keeps static primitives distinct from explicitly reactive primitive inputs', () => {
    const source = MutableState.of(2);

    const Scale = once(({ input, scale }: { input: IReadableClosure<number>; scale: number }) =>
      useMap(input, (value) => value * scale),
    );

    const closure = render(<Scale input={source} scale={3} />);

    expect(closure.value.value).toBe(6);

    source.next(4);

    expect(closure.value.value).toBe(12);

    closure.destroy();
    source.destroy();
  });

  test('builds once on the first value access and follows its readable inputs', () => {
    const source = MutableState.of(2);

    const build = vi.fn(({ input, scale }: { input: IReadableClosure<number>; scale: number }) =>
      useMap(input, (value) => value * scale),
    );

    const Scale = once(build);

    const closure = render(S([Scale, { input: source, scale: D(3) }]));

    expect(build).not.toHaveBeenCalled();
    expect(closure.value.value).toBe(6);

    source.next(4);

    expect(closure.value.value).toBe(12);
    expect(build).toHaveBeenCalledTimes(1);

    closure.destroy();

    expect(source.closed).toBe(false);

    source.destroy();
  });

  test('uses the same source, descriptor and static inputs through S and JSX', () => {
    const source = new BehaviorSubject(2);

    const Sum = once(
      ({
        left,
        right,
        label,
      }: {
        left: IReadableClosure<number>;
        right: IReadableClosure<number>;
        label: string;
      }) => useCombineMap([left, right], ([a, b]) => `${label}: ${a + b}`),
    );

    const fromS = render(
      S([
        Sum,
        {
          left: source,
          right: S([Double, { value: source }]),
          label: D('sum'),
        },
      ]),
    );

    const fromJSX = render(
      <Sum left={source} right={<Double value={source} />} label={D('sum')} />,
    );

    expect(fromS.value.value).toBe('sum: 6');
    expect(fromJSX.value.value).toBe('sum: 6');

    source.next(4);

    expect(fromS.value.value).toBe('sum: 12');
    expect(fromJSX.value.value).toBe('sum: 12');

    fromS.destroy();
    fromJSX.destroy();

    expect(source.observed).toBe(false);
    expect(source.isStopped).toBe(false);

    source.complete();
  });

  test('keeps unused inputs fully lazy', () => {
    const start = vi.fn(() => () => {});

    const source = new ReactiveState({ initial: 1, emitter: start });

    const Ignore = once((_inputs: { unused: IReadableClosure<number> }) =>
      ReactiveState.of('ready'),
    );

    const closure = render(S([Ignore, { unused: source }]));

    expect(closure.value.value).toBe('ready');
    expect(start).not.toHaveBeenCalled();

    closure.destroy();

    expect(start).not.toHaveBeenCalled();
  });

  test('wraps callback results lazily, preserves argument identity, and owns generated closures', () => {
    const setup = vi.fn();
    const cleanup = vi.fn();

    class Child extends BaseStateClosure<number, { amount: number }> {
      protected render() {
        const { amount } = this.inputs;

        setup();

        this.clearable(cleanup);

        return ReactiveState.of(amount);
      }
    }

    const params = { amount: 7 };
    const generate = vi.fn((input: typeof params) => S([Child, { amount: D(input.amount) }]));
    let generated: IReadableClosure<number>;

    const Parent = once(
      ({ create }: { create: (input: typeof params) => IReadableClosure<number> }) => {
        generated = create(params);

        expect(setup).not.toHaveBeenCalled();

        return generated;
      },
    );

    const parent = render(S([Parent, { create: generate }]));

    expect(generate).not.toHaveBeenCalled();
    expect(parent.value.value).toBe(7);
    expect(generate.mock.calls[0][0]).toBe(params);
    expect(setup).toHaveBeenCalledTimes(1);

    parent.destroy();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(generated!.value.closed).toBe(true);
  });

  test('accepts zero-argument generators and keeps D-wrapped callbacks unchanged', () => {
    const source = new BehaviorSubject(3);

    const Calculate = once(
      ({ create, power }: { create: () => IReadableClosure<number>; power: typeof calculate }) => {
        expect(power).toBe(calculate);

        return useMap(create(), power);
      },
    );

    const closure = render(S([Calculate, { create: () => source, power: D(calculate) }]));

    expect(closure.value.value).toBe(9);

    source.next(4);

    expect(closure.value.value).toBe(16);

    closure.destroy();

    expect(source.observed).toBe(false);

    source.complete();
  });

  test('assigns forwarded generator results to the receiving closure', () => {
    const source = new BehaviorSubject(3);
    const generate = vi.fn(() => source);
    const Forward = once(({ create }: { create: () => IReadableClosure<number> }) =>
      ReactiveState.of(create),
    );

    const Receive = once(({ create }: { create: () => IReadableClosure<number> }) => create());
    const forwarder = render(S([Forward, { create: generate }]));
    const receiver = render(S([Receive, { create: forwarder.value.value }]));

    expect(receiver.value.value).toBe(3);
    expect(source.observed).toBe(true);

    receiver.destroy();

    expect(source.observed).toBe(false);
    expect(source.isStopped).toBe(false);

    const nextReceiver = render(S([Receive, { create: forwarder.value.value }]));

    expect(nextReceiver.value.value).toBe(3);
    expect(generate).toHaveBeenCalledTimes(2);

    nextReceiver.destroy();
    forwarder.destroy();
    source.complete();
  });

  test('retains shared forwarded results until their last receiving closure is destroyed', () => {
    const source = new BehaviorSubject(3);
    const shared = render(S([({ value }: { value: number }) => value, { value: source }]));
    const Forward = once(({ create }: { create: () => IReadableClosure<number> }) =>
      ReactiveState.of(create),
    );

    const Receive = once(({ create }: { create: () => IReadableClosure<number> }) => create());
    const forwarder = render(S([Forward, { create: () => shared }]));
    const first = render(S([Receive, { create: forwarder.value.value }]));
    const second = render(S([Receive, { create: forwarder.value.value }]));

    expect(first.value.value).toBe(3);
    expect(second.value.value).toBe(3);

    first.destroy();
    source.next(4);

    expect(shared.value.closed).toBe(false);
    expect(second.value.value).toBe(4);

    second.destroy();

    expect(shared.value.closed).toBe(true);
    expect(source.observed).toBe(false);

    forwarder.destroy();
    source.complete();
  });

  test('keeps a forwarded generator available to a live recipient after its forwarder is destroyed', () => {
    const source = new BehaviorSubject(3);
    const generate = vi.fn(() => source);
    const Forward = once(({ create }: { create: () => IReadableClosure<number> }) =>
      ReactiveState.of(create),
    );

    const Receive = once(({ create }: { create: () => IReadableClosure<number> }) => create());
    const forwarder = render(S([Forward, { create: generate }]));
    const receiver = render(S([Receive, { create: forwarder.value.value }]));

    forwarder.destroy();

    expect(generate).not.toHaveBeenCalled();
    expect(receiver.value.value).toBe(3);

    source.next(4);

    expect(receiver.value.value).toBe(4);

    receiver.destroy();

    expect(source.observed).toBe(false);

    source.complete();
  });

  test('preserves frozen callable properties and context without changing the original function', () => {
    const original = Object.freeze(Object.assign(factory, { label: 'scale' }));

    const wrapped = once(original);

    expect(wrapped).not.toBe(original);
    expect(isOnceFunction(wrapped)).toBe(true);
    expect(isOnceFunction(original)).toBe(false);
    expect(Object.getOwnPropertySymbols(original)).toEqual([]);
    expect(wrapped.label).toBe('scale');
    expect(wrapped.call({ scale: 2 }, { value: 3 }).value).toBe(6);
    expectTypeOf(wrapped.label).toEqualTypeOf<string>();
  });
});
