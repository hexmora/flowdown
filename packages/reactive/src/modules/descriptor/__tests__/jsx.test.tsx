import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  buildDescriptor,
  D,
  type IReactiveState,
  type IStateClosure,
  type JSXDescriptor,
  type MappingDescriptorValue,
  MutableState,
  S,
} from '../..';
import { createElement, Fragment, jsx } from '../../..';

type CountStateClosureInputs = {
  label?: string;

  source: IReactiveState<number>;
};

class CountStateClosure extends BaseStateClosure<number, CountStateClosureInputs> {
  static instances = 0;

  constructor(inputs: CountStateClosureInputs) {
    super(inputs);

    CountStateClosure.instances += 1;
  }

  protected render() {
    return this.inputs.source;
  }
}

class EmptyStateClosure extends BaseStateClosure<'empty'> {
  protected render() {
    return 'empty' as const;
  }
}

type Policy = {
  format(value: number): string;
};

type RootStateClosureInputs = {
  child: IReactiveState<number>;

  key: string;

  policy: Policy;
};

class RootStateClosure extends BaseStateClosure<number, RootStateClosureInputs> {
  static instances = 0;

  constructor(inputs: RootStateClosureInputs) {
    super(inputs);

    RootStateClosure.instances += 1;
  }

  protected render() {
    return this.inputs.child;
  }
}

type Factory = {
  create(source: IReactiveState<number>): IReactiveState<string>;
};

class FactoryStateClosure extends BaseStateClosure<Factory, Factory> {
  protected render() {
    return this.inputs;
  }
}

class StringStateClosure extends BaseStateClosure<string, { source: IReactiveState<number> }> {
  protected render() {
    return this.map(this.inputs.source, String);
  }
}

class StringSourceStateClosure extends BaseStateClosure<
  string,
  { label?: string; source: IReactiveState<string> }
> {
  protected render() {
    return this.inputs.source;
  }
}

class PositionalStateClosure extends BaseStateClosure<number, IReactiveState<number>> {
  protected render() {
    return this.inputs;
  }
}

class GenericStateClosure<T> extends BaseStateClosure<T, { source: IReactiveState<T> }> {
  protected render() {
    return this.inputs.source;
  }
}

class OptionalObjectStateClosure extends BaseStateClosure<
  number,
  { source: IReactiveState<number> } | undefined
> {
  protected render() {
    return this.inputs?.source ?? 0;
  }
}

class DefaultObjectStateClosure extends BaseStateClosure<string, { label?: string }> {
  constructor(inputs: { label?: string } = { label: 'default' }) {
    super(inputs);
  }

  protected render() {
    return this.inputs.label ?? 'empty';
  }
}

class MultipleParametersStateClosure extends BaseStateClosure<
  number,
  { source: IReactiveState<number> }
> {
  constructor(inputs: { source: IReactiveState<number> }, _label: string) {
    super(inputs);
  }

  protected render() {
    return this.inputs.source;
  }
}

class OptionalTrailingStateClosure extends BaseStateClosure<
  number,
  { source: IReactiveState<number> }
> {
  constructor(inputs: { source: IReactiveState<number> }, _label = 'optional') {
    super(inputs);
  }

  protected render() {
    return this.inputs.source;
  }
}

class OptionalPrimitiveStateClosure extends BaseStateClosure<number, number> {
  constructor(inputs = 0) {
    super(inputs);
  }

  protected render() {
    return this.inputs;
  }
}

const FunctionComponent = () => <EmptyStateClosure />;

describe('descriptor JSX runtime', () => {
  test('emits lazy descriptor tuples and builds the requested value type', () => {
    const source = MutableState.of(2);
    const policy: Policy = { format: String };

    CountStateClosure.instances = 0;
    RootStateClosure.instances = 0;

    const descriptor = (
      <RootStateClosure
        child={<CountStateClosure label="count" source={source} />}
        key="root"
        policy={D(policy)}
      />
    );

    expect(CountStateClosure.instances).toBe(0);
    expect(RootStateClosure.instances).toBe(0);
    expect(descriptor).toEqual([
      RootStateClosure,
      {
        child: [CountStateClosure, { label: 'count', source }],
        key: 'root',
        policy: D(policy),
      },
    ]);

    const closure = buildDescriptor<number>(descriptor);

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<number>>();
    expect(closure).toBeInstanceOf(RootStateClosure);
    expect(closure.value.value).toBe(2);
    expect(CountStateClosure.instances).toBe(1);
    expect(RootStateClosure.instances).toBe(1);

    closure.destroy();
    source.destroy();
  });

  test('brands JSX descriptors with S and infers their built value type', () => {
    const source = MutableState.of(3);
    const descriptor = S<number>(<CountStateClosure source={source} />);

    expectTypeOf(descriptor).toEqualTypeOf<JSXDescriptor<number>>();

    const closure = buildDescriptor(descriptor);

    expectTypeOf(closure).toEqualTypeOf<IStateClosure<number>>();
    expect(closure.value.value).toBe(3);

    source.next(5);

    expect(closure.value.value).toBe(5);

    closure.destroy();
    source.destroy();
  });

  test('supports descriptor generators that return JSX', () => {
    const factory = buildDescriptor<Factory>(
      <FactoryStateClosure
        create={(source) => S<string>(<StringStateClosure source={source} />)}
      />,
    );

    const source = MutableState.of(42);
    const generated = factory.value.value.create(source);

    expect(generated.value).toBe('42');

    source.next(7);

    expect(generated.value).toBe('7');

    source.destroy();
    factory.destroy();
  });

  test('builds JSX returned by render through the owned descriptor graph', () => {
    const source = MutableState.of(1);
    const destroyChild = vi.fn();

    class TrackedStateClosure extends BaseStateClosure<number, { source: IReactiveState<number> }> {
      protected render() {
        return this.inputs.source;
      }

      override destroy() {
        destroyChild();

        super.destroy();
      }
    }

    class JSXRenderStateClosure extends BaseStateClosure<
      number,
      { source: IReactiveState<number> }
    > {
      protected render() {
        return S<number>(<TrackedStateClosure source={this.inputs.source} />);
      }
    }

    const closure = new JSXRenderStateClosure({ source });

    expect(destroyChild).not.toHaveBeenCalled();
    expect(closure.value.value).toBe(1);

    source.next(2);

    expect(closure.value.value).toBe(2);

    closure.destroy();
    closure.destroy();

    expect(destroyChild).toHaveBeenCalledOnce();

    source.destroy();
  });

  test('supports native void-input state closures', () => {
    const closure = buildDescriptor<'empty'>(<EmptyStateClosure />);

    expect(closure.value.value).toBe('empty');

    closure.destroy();
  });

  test('treats an omitted default object as empty JSX props', () => {
    const closure = buildDescriptor<string>(<DefaultObjectStateClosure />);

    expect(closure.value.value).toBe('empty');

    closure.destroy();
  });

  test('keeps exact descriptor types when the runtime is called directly', () => {
    const source = MutableState.of(1);
    const descriptor = jsx(CountStateClosure, { source });

    expectTypeOf(descriptor[0]).toEqualTypeOf<typeof CountStateClosure>();
    expect(descriptor).toEqual([CountStateClosure, { source }]);

    source.destroy();
  });

  test('rejects fragments instead of emitting a non-closure descriptor', () => {
    expect(() => jsx(Fragment, { children: [] })).toThrow(
      'Descriptor JSX fragments are not supported.',
    );
  });

  test('supports classic fallback emission for a key after spread props', () => {
    const source = MutableState.of(3);
    const policy: Policy = { format: String };
    const props = {
      child: <CountStateClosure source={source} />,
      policy: D(policy),
    };
    const descriptor = <RootStateClosure {...props} key="spread-root" />;

    expect(descriptor).toEqual(
      createElement(RootStateClosure, {
        ...props,
        key: 'spread-root',
      }),
    );

    source.destroy();
  });

  test('lets a spread key override an earlier explicit key', () => {
    const source = MutableState.of(3);
    const policy: Policy = { format: String };
    const props = {
      child: <CountStateClosure source={source} />,
      key: 'spread-key',
      policy: D(policy),
    };
    // @ts-expect-error This intentionally verifies JSX's source-order key precedence.
    const descriptor = <RootStateClosure key="explicit-key" {...props} />;

    expect(descriptor).toEqual([RootStateClosure, props]);

    source.destroy();
  });
});

const createGenericDescriptor = <
  C extends new (inputs: { source: IReactiveState<number> }) => IStateClosure<number>,
>(
  Closure: C,
  source: IReactiveState<number>,
) => <Closure source={source} />;

const _typecheckDescriptorJSX = () => {
  const source = MutableState.of(1);
  const DynamicStateClosure = source.value > 0 ? CountStateClosure : StringSourceStateClosure;
  const policy = D<Policy>({ format: String });

  <EmptyStateClosure />;
  <CountStateClosure source={source} />;
  <GenericStateClosure<number> source={source} />;
  <OptionalObjectStateClosure source={source} />;
  <OptionalTrailingStateClosure source={source} />;
  createGenericDescriptor(CountStateClosure, source);

  jsx(OptionalTrailingStateClosure, { source });

  const descriptor = S<number>(<CountStateClosure source={source} />);

  expectTypeOf(descriptor).toEqualTypeOf<JSXDescriptor<number>>();
  expectTypeOf<MappingDescriptorValue<typeof descriptor>>().toEqualTypeOf<number>();
  expectTypeOf(S(<CountStateClosure source={source} />)).toMatchTypeOf<JSXDescriptor<unknown>>();
  expectTypeOf(buildDescriptor(descriptor)).toEqualTypeOf<IStateClosure<number>>();
  expectTypeOf(buildDescriptor(<CountStateClosure source={source} />)).toMatchTypeOf<
    IStateClosure<unknown>
  >();
  expectTypeOf(buildDescriptor<number>(<CountStateClosure source={source} />)).toEqualTypeOf<
    IStateClosure<number>
  >();

  // Raw JSX has already erased its creator, so explicit value types are trusted.
  expectTypeOf(buildDescriptor<string>(<CountStateClosure source={source} />)).toEqualTypeOf<
    IStateClosure<string>
  >();
  expectTypeOf(buildDescriptor(EmptyStateClosure)).toEqualTypeOf<EmptyStateClosure>();
  expectTypeOf(
    buildDescriptor(S([CountStateClosure, { source }])),
  ).toEqualTypeOf<CountStateClosure>();

  const directDescriptor = jsx(CountStateClosure, { source });

  expectTypeOf(buildDescriptor(directDescriptor)).toEqualTypeOf<CountStateClosure>();

  // @ts-expect-error Direct runtime calls retain their exact output value type.
  S<string>(directDescriptor);

  // @ts-expect-error Direct runtime calls retain their exact output value type.
  buildDescriptor<string>(directDescriptor);

  // @ts-expect-error A dynamic tag must be safe for every constructor branch.
  <DynamicStateClosure source={source} />;

  // @ts-expect-error A dynamic tag must be safe for every constructor branch.
  <DynamicStateClosure source={MutableState.of('wrong')} />;

  // @ts-expect-error Explicit generic arguments remain part of the prop contract.
  <GenericStateClosure<number> source={MutableState.of('wrong')} />;

  // @ts-expect-error Required inputs stay required.
  <CountStateClosure />;

  // @ts-expect-error Unknown inputs are rejected.
  <CountStateClosure extra source={source} />;

  // @ts-expect-error Descriptor inputs preserve their source value type.
  <CountStateClosure source={MutableState.of('wrong')} />;

  <RootStateClosure
    // @ts-expect-error S preserves the nested descriptor's declared output type.
    child={S<string>(<StringStateClosure source={source} />)}
    key="root"
    policy={policy}
  />;

  // @ts-expect-error State slots do not accept direct values.
  <RootStateClosure child={1} key="root" policy={policy} />;

  // @ts-expect-error Descriptor generators must return a state descriptor.
  <FactoryStateClosure create={() => 'wrong'} />;

  // @ts-expect-error Positional inputs are intentionally unsupported in JSX.
  <PositionalStateClosure />;

  // @ts-expect-error Optional input objects keep their required fields in JSX.
  <OptionalObjectStateClosure />;

  // @ts-expect-error Multiple constructor parameters are intentionally unsupported in JSX.
  <MultipleParametersStateClosure />;

  // @ts-expect-error Primitive constructor inputs are unsupported even when defaulted.
  <OptionalPrimitiveStateClosure />;

  // @ts-expect-error Void-input closures do not accept props.
  <EmptyStateClosure extra />;

  // @ts-expect-error JSX tags must be state closure classes.
  <FunctionComponent />;

  // @ts-expect-error Intrinsic JSX tags are not descriptor nodes.
  <div />;
};

void _typecheckDescriptorJSX;
