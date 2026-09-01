import { jsx } from 'reactive/jsx-runtime';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  D,
  type IReactiveState,
  type IStateClosure,
  type JSXDescriptor,
  memo,
  MutableState,
  render,
  S,
} from '../../..';

const GenericIdentity = /*#__PURE__*/ memo(function GenericIdentity<T>({ value }: { value: T }): T {
  return value;
});

const CallbackMapper = /*#__PURE__*/ memo(({ callback }: { callback: () => number }) => callback());

const PlainMapper = ({ value }: { value: number }) => value;

const ParityMapper = ({ value }: { value: number }) => ({ parity: value % 2 });

const NoPropsMapper = /*#__PURE__*/ memo(() => 'empty');

const StateValueMapper = ({ source }: { source: IReactiveState<number> }) => source.value;

describe('memo', () => {
  test('creates a lazy mapped state closure', () => {
    const mapper = vi.fn(({ value }: { value: number }) => value * 2);

    const Doubled = memo(mapper);

    const source = MutableState.of(2);

    const closure = render<number>(S<number>(<Doubled value={source} />));

    expect(mapper).not.toHaveBeenCalled();

    expect(closure.value.value).toBe(4);

    expect(mapper).toHaveBeenCalled();

    source.next(3);

    expect(closure.value.value).toBe(6);

    mapper.mockClear();

    closure.destroy();

    source.next(4);

    expect(mapper).not.toHaveBeenCalled();

    source.destroy();
  });

  test('uses shallow output equality by default', () => {
    const source = MutableState.of(1);

    const Values = memo(({ value }: { value: number }) => [value % 2]);

    const closure = render<number[]>(S<number[]>(<Values value={source} />));

    const next = vi.fn();

    closure.value.subscribe(next);

    const initial = closure.value.value;

    next.mockClear();

    source.next(3);

    expect(closure.value.value).toBe(initial);

    expect(next).not.toHaveBeenCalled();

    source.next(2);

    expect(closure.value.value).toEqual([0]);

    expect(next).toHaveBeenCalledOnce();

    closure.destroy();

    source.destroy();
  });

  test('distinguishes unequal primitive outputs', () => {
    const source = MutableState.of(1);

    const Identity = memo(({ value }: { value: number }) => value);

    const closure = render<number>(S<number>(<Identity value={source} />));

    expect(closure.value.value).toBe(1);

    source.next(2);

    expect(closure.value.value).toBe(2);

    closure.destroy();

    source.destroy();
  });

  test('accepts a custom output distinctor', () => {
    const source = MutableState.of({ id: 1, value: 'first' });

    const distinctor = vi.fn(
      (left: { id: number; value: string }, right: { id: number; value: string }) => {
        return left.id === right.id;
      },
    );

    const Item = memo(({ item }: { item: { id: number; value: string } }) => item, distinctor);

    const closure = render<{ id: number; value: string }>(
      S<{ id: number; value: string }>(<Item item={source} />),
    );

    const initial = closure.value.value;

    source.next({ id: 1, value: 'second' });

    expect(closure.value.value).toBe(initial);

    source.next({ id: 2, value: 'second' });

    expect(closure.value.value).toEqual({ id: 2, value: 'second' });

    expect(distinctor).toHaveBeenCalled();

    closure.destroy();

    source.destroy();
  });

  test('uses Object.is output equality for raw functions', () => {
    const source = MutableState.of(1);

    const closure = render(S([ParityMapper, { value: source }]));

    const initial = closure.value.value;

    const next = vi.fn();

    closure.value.subscribe(next);

    next.mockClear();

    source.next(3);

    expect(closure.value.value).toEqual(initial);
    expect(closure.value.value).not.toBe(initial);

    expect(next).toHaveBeenCalledOnce();

    closure.destroy();

    source.destroy();
  });

  test('marks memo metadata with a named symbol', () => {
    const Mapper = memo(({ value }: { value: number }) => value);

    const [key] = Object.getOwnPropertySymbols(Mapper);

    expect(key?.description).toBe('MemoedMapper');
    expect(key === undefined ? undefined : Symbol.keyFor(key)).toBeUndefined();
  });

  test('preserves D-wrapped mapper props', () => {
    type Policy = {
      format(value: number): string;
    };

    const PolicyMapper = memo(({ policy }: { policy: Policy }) => policy.format(1));

    const closure = render<string>(
      S<string>(<PolicyMapper policy={D<Policy>({ format: String })} />),
    );

    expect(closure.value.value).toBe('1');

    closure.destroy();
  });

  test('supports direct JSX runtime calls', () => {
    const source = MutableState.of(2);

    const Doubled = memo(({ value }: { value: number }) => value * 2);

    const NullValue = memo((): null => null);

    const UndefinedValue = memo((): undefined => undefined);

    const direct = jsx(Doubled, { value: source });

    const nullDescriptor = jsx(NullValue, {});

    const undefinedDescriptor = jsx(UndefinedValue, {});

    expectTypeOf(direct).toMatchTypeOf<JSXDescriptor<number>>();

    expectTypeOf(nullDescriptor).toEqualTypeOf<JSXDescriptor<null>>();

    expectTypeOf(undefinedDescriptor).toEqualTypeOf<JSXDescriptor<undefined>>();

    expectTypeOf(NullValue()).toEqualTypeOf<null>();

    expectTypeOf(UndefinedValue()).toEqualTypeOf<undefined>();

    expectTypeOf(render(direct)).toEqualTypeOf<IStateClosure<number>>();

    expectTypeOf(render(nullDescriptor)).toEqualTypeOf<IStateClosure<null>>();

    expectTypeOf(render(undefinedDescriptor)).toEqualTypeOf<IStateClosure<undefined>>();

    const directClosure = render(direct);

    const nullClosure = render(nullDescriptor);

    const undefinedClosure = render(undefinedDescriptor);

    expect(directClosure.value.value).toBe(4);

    expect(nullClosure.value.value).toBeNull();

    expect(undefinedClosure.value.value).toBeUndefined();

    directClosure.destroy();

    nullClosure.destroy();

    undefinedClosure.destroy();

    source.destroy();
  });
});

const _typecheckMemoJSX = () => {
  const source = MutableState.of('value');

  const descriptor = S<string>(<GenericIdentity<string> value={source} />);

  const directDescriptor = jsx(GenericIdentity<string>, { value: source });

  const plainDescriptor = S<number>(<PlainMapper value={1} />);

  const immediateSource = MutableState.of(1);

  expectTypeOf(GenericIdentity<string>({ value: 'value' })).toEqualTypeOf<string>();

  expectTypeOf(descriptor).toEqualTypeOf<JSXDescriptor<string>>();

  expectTypeOf(directDescriptor).toEqualTypeOf<JSXDescriptor<string>>();

  expectTypeOf(render(descriptor)).toEqualTypeOf<IStateClosure<string>>();

  expectTypeOf(plainDescriptor).toEqualTypeOf<JSXDescriptor<number>>();

  expectTypeOf(render(plainDescriptor)).toEqualTypeOf<IStateClosure<number>>();

  // @ts-expect-error Explicit mapper generics remain part of the prop contract.
  <GenericIdentity<string> value={MutableState.of(1)} />;

  // @ts-expect-error Required mapper props stay required.
  <GenericIdentity<string> />;

  // @ts-expect-error Unknown mapper props are rejected.
  <GenericIdentity<string> extra value={source} />;

  <CallbackMapper callback={D(() => 1)} />;

  // @ts-expect-error Function-valued mapper props must be wrapped with D().
  <CallbackMapper callback={() => 1} />;

  <PlainMapper value={1} />;

  <NoPropsMapper />;

  // @ts-expect-error Empty mapper props reject unknown attributes.
  <NoPropsMapper extra />;

  <StateValueMapper source={D(immediateSource)} />;

  jsx(StateValueMapper, { source: D(immediateSource) });

  // @ts-expect-error Reactive states passed as mapper values must be wrapped with D().
  <StateValueMapper source={immediateSource} />;

  // @ts-expect-error Reactive states passed as mapper values must be wrapped with D().
  jsx(StateValueMapper, { source: immediateSource });
};

void _typecheckMemoJSX;
