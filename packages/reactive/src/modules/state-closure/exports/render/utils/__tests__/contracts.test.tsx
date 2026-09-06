/** @jsxImportSource ../../../../../.. */
import { BehaviorSubject } from 'rxjs';
import { expectTypeOf, test } from 'vitest';

import {
  BaseStateClosure,
  D,
  type IReactiveState,
  type IReadableClosure,
  jsx,
  memo,
  memoReturns,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
  type StateClosureInputProps,
  type StateClosureResult,
  useMap,
} from '../../../../../..';

type Inputs = {
  value: IReadableClosure<number>;
  label: string;
  generate: (params: { scale: number }) => IReadableClosure<number>;
  fallback: () => IReadableClosure<number>;
  power: (value: number) => number;
};

const Once = once(({ value }: Inputs) => value);

const power = (value: number) => value ** 2;

const Mapper = <T,>({ value }: { value: T }) => ({ value });

class Class extends BaseStateClosure<number, Inputs> {
  protected render() {
    const { value } = this.inputs;

    return value;
  }
}

const _typecheckContracts = () => {
  const source = MutableState.of(2);
  const subject = new BehaviorSubject(3);
  const inputs: StateClosureInputProps<Inputs> = {
    value: source,
    label: 'value',
    generate: ({ scale }) => scale,
    fallback: () => subject,
    power: D(power),
  };

  S([Once, inputs]);
  S([Class, inputs]);
  <Once {...inputs} />;
  <Class {...inputs} />;
  jsx(Once, inputs);
  jsx(Class, inputs);
  render<number>([Once, inputs]);

  const Identity = once(<T,>({ value }: { value: IReadableClosure<T> }) => value);
  const generic = render(S([Identity<number>, { value: source }]));

  expectTypeOf(generic).toEqualTypeOf<IReadableClosure<number>>();

  expectTypeOf(render(null)).toEqualTypeOf<IReadableClosure<null>>();
  expectTypeOf(render(S([once(() => null), {}]))).toEqualTypeOf<IReadableClosure<null>>();

  // @ts-expect-error Null descriptors emit null, not an unrelated value type.
  render<number>(null);

  // @ts-expect-error A non-null class output cannot render null.
  const nonNullableResult: StateClosureResult<number> = null;

  void nonNullableResult;

  class NonNullable extends BaseStateClosure<number> {
    // @ts-expect-error Class render must preserve its non-null declared output type.
    protected render() {
      return null;
    }
  }

  void NonNullable;

  const Optional = once(
    ({
      value,
      fallback = null,
    }: {
      value?: IReadableClosure<number | null>;
      fallback?: number | null;
    }) => value ?? ReactiveState.of(fallback),
  );

  expectTypeOf(render(S([Optional, {}]))).toEqualTypeOf<IReadableClosure<number | null>>();
  S([Optional, { value: source, fallback: null }]);
  <Optional value={ReactiveState.of(null)} fallback={3} />;
  <Optional value={undefined} fallback={D(null)} />;

  // @ts-expect-error A nullable readable still requires an explicit state source.
  S([Optional, { value: null }]);

  // @ts-expect-error Static primitive inputs do not consume reactive state sources.
  <Optional fallback={source} />;

  const enabled: boolean = source.value > 0;
  const mode: 'a' | 'b' = enabled ? 'a' : 'b';
  const label: string | undefined = enabled ? 'value' : undefined;
  const settings: { active: boolean } | { mode: string } = enabled ? { active: enabled } : { mode };

  type StaticInputs = {
    enabled: boolean;
    mode: 'a' | 'b';
    label: string | undefined;
    settings: typeof settings;
  };

  const Static = once((props: StaticInputs) => ReactiveState.of(props));

  class StaticReader extends BaseStateClosure<StaticInputs, StaticInputs> {
    protected render() {
      const { inputs: props } = this;

      return ReactiveState.of(props);
    }
  }

  S([Static, { enabled: D(enabled), mode: D(mode), label: D(label), settings: D(settings) }]);
  <Static enabled={D(enabled)} mode={D(mode)} label={D(label)} settings={D(settings)} />;
  S([StaticReader, { enabled: D(enabled), mode: D(mode), label: D(label), settings: D(settings) }]);
  <StaticReader enabled={D(enabled)} mode={D(mode)} label={D(label)} settings={D(settings)} />;

  const UnknownStatic = once(({ value }: { value: unknown }) => ReactiveState.of(value));

  S([UnknownStatic, { value: 2 }]);
  <UnknownStatic value="value" />;

  // @ts-expect-error A statically declared unknown object still needs D to preserve its identity.
  <UnknownStatic value={source} />;

  // @ts-expect-error Static object unions still require D around the whole value.
  <Static enabled={enabled} mode={mode} label={label} settings={settings} />;

  // @ts-expect-error Optional readable inputs cannot bypass ownership with D.
  <Optional value={D(source)} />;

  const mapped = render(S([memo(Mapper), { value: source }]));

  expectTypeOf(mapped).toEqualTypeOf<IReadableClosure<{ value: number }>>();

  // Mapper outputs remain values, even when a value happens to be a state object.
  const raw = render(S([() => source, {}]));

  expectTypeOf(raw).toEqualTypeOf<IReadableClosure<MutableState<number>>>();

  const readable = render(S([() => 2, {}]));

  type MixedInputs = { value: IReadableClosure<number> | { tag: string } | string };

  const Mixed = once((_props: MixedInputs) => null);

  class MixedReader extends BaseStateClosure<null, MixedInputs> {
    protected render() {
      return null;
    }
  }

  S([Mixed, { value: readable }]);
  <Mixed value={D({ tag: 'value' })} />;
  <Mixed value="value" />;
  S([MixedReader, { value: readable }]);
  <MixedReader value={D({ tag: 'value' })} />;

  // @ts-expect-error A mixed static/readable union still cannot bypass readable ownership.
  <Mixed value={D(readable)} />;

  // @ts-expect-error Classes retain the same static/readable union constraint.
  S([MixedReader, { value: D(readable) }]);

  const staticInputs: Inputs = {
    value: readable,
    label: 'value',
    generate: () => readable,
    fallback: () => readable,
    power,
  };

  S([Once, { ...inputs, label: 'value' }]);

  S([Once, { ...inputs, label: D('value') }]);

  // @ts-expect-error Object inputs must use per-slot D so readable inputs and factories remain owned.
  S([Class, D(staticInputs)]);

  // @ts-expect-error Once functions use the same per-slot contract as classes and JSX.
  S([Once, D(staticInputs)]);

  <Class {...inputs} label="value" />;

  // @ts-expect-error Primitive readable inputs require explicit state sources.
  S([Once, { ...inputs, value: 2 }]);

  // @ts-expect-error Class and once inputs use the same primitive convention.
  <Class {...inputs} value={2} />;

  // @ts-expect-error D passes a raw number instead of constructing a readable closure.
  <Once {...inputs} value={D(2)} />;

  // @ts-expect-error Readable inputs preserve their emitted value type.
  S([Class, { ...inputs, value: MutableState.of('wrong') }]);

  // @ts-expect-error Generator arguments remain the declared object, without mapping its fields.
  <Once {...inputs} generate={({ scale }: { scale: IReadableClosure<number> }) => scale} />;

  // @ts-expect-error Generator return values preserve the expected source value type.
  S([Class, { ...inputs, generate: () => 'wrong' }]);

  // @ts-expect-error A generator is wrapped by the builder, not passed through D.
  <Once {...inputs} fallback={D(() => render(S([() => 1, {}])))} />;

  // @ts-expect-error Ordinary callbacks are static values and require D.
  S([Once, { ...inputs, power }]);

  // @ts-expect-error Once functions do not participate in mapper memoization.
  memo(Once);

  // @ts-expect-error Classes do not participate in mapper memoization.
  memoReturns(Class);

  // @ts-expect-error Once descriptors do not accept a mapper return comparer.
  S([Once, inputs, Object.is]);

  // @ts-expect-error Legacy root tuples preserve the distinction between mapper and once results.
  render<IReactiveState<number>>([once(() => ReactiveState.of(1)), {}]);

  const Primitive = once(({ value }: { value: number }) => value);

  expectTypeOf(render(S([Primitive, { value: 2 }]))).toEqualTypeOf<IReadableClosure<number>>();

  const Nested = once(({ value }: { value: IReadableClosure<IReactiveState<number>> }) => value);

  <Nested value={ReactiveState.of(source)} />;

  // @ts-expect-error A source of numbers does not emit reactive state objects.
  <Nested value={source} />;

  const Unknown = once(({ value }: { value: IReadableClosure<unknown> }) => value);

  <Unknown value={ReactiveState.of({ count: 1 })} />;

  // @ts-expect-error An unknown raw value cannot be distinguished from descriptor syntax.
  <Unknown value={{ count: 1 }} />;

  const Scale = once(({ value }: { value: IReadableClosure<number> }) => useMap(value, power));

  S([Scale, { value: S([({ value }: { value: number }) => value, { value: source }]) }]);
};

test('checks descriptor and JSX contracts without constructing their state flows', () => {
  expectTypeOf(_typecheckContracts).toEqualTypeOf<() => void>();
});
