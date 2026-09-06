import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  createElement,
  D,
  Fragment,
  type IReactiveState,
  type IReadableClosure,
  jsx,
  type JSXDescriptor,
  type MappingDescriptorValue,
  MutableState,
  once,
  ReactiveState,
  render,
  S,
} from '../../../../../..';

type CountInputs = {
  label?: string;

  source: IReadableClosure<number>;
};

class Count extends BaseStateClosure<number, CountInputs> {
  static instances = 0;

  constructor(inputs: CountInputs) {
    super(inputs);

    Count.instances += 1;
  }

  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

class Empty extends BaseStateClosure<'empty'> {
  protected render() {
    return ReactiveState.of('empty' as const);
  }
}

type Policy = {
  format(value: number): string;
};

type RootInputs = {
  child: IReadableClosure<number>;

  key: string;

  policy: Policy;
};

class Root extends BaseStateClosure<number, RootInputs> {
  static instances = 0;

  constructor(inputs: RootInputs) {
    super(inputs);

    Root.instances += 1;
  }

  protected render() {
    const { child } = this.inputs;

    return child;
  }
}

type Factory = {
  create(params: { source: IReadableClosure<number> }): IReadableClosure<string>;
};

type RawFactory = {
  create(source: IReactiveState<number>): JSXDescriptor<string>;
};

class FactoryReader extends BaseStateClosure<RawFactory, RawFactory> {
  protected render() {
    const { inputs } = this;

    return ReactiveState.of(inputs);
  }
}

const FunctionalFactory = once(({ create }: Factory) => ReactiveState.of({ create }));

class Formatted extends BaseStateClosure<string, { source: IReadableClosure<number> }> {
  protected render() {
    const { source } = this.inputs;

    return this.map(source, String);
  }
}

const createStringDescriptor = (source: IReactiveState<number>): JSXDescriptor<string> =>
  S<string>(<Formatted source={source} />);

class StringSource extends BaseStateClosure<
  string,
  { label?: string; source: IReadableClosure<string> }
> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

class Positional extends BaseStateClosure<number, IReadableClosure<number>> {
  protected render() {
    const { inputs } = this;

    return inputs;
  }
}

class Generic<T> extends BaseStateClosure<T, { source: IReadableClosure<T> }> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

class OptionalObject extends BaseStateClosure<
  number,
  { source: IReadableClosure<number> } | undefined
> {
  protected render() {
    const { source } = this.inputs ?? {};

    return source ?? ReactiveState.of(0);
  }
}

class DefaultObject extends BaseStateClosure<string, { label?: string }> {
  constructor(inputs: { label?: string } = { label: 'default' }) {
    super(inputs);
  }

  protected render() {
    const { label = 'empty' } = this.inputs;

    return ReactiveState.of(label);
  }
}

class MultipleParameters extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
  constructor(inputs: { source: IReadableClosure<number> }, _label: string) {
    super(inputs);
  }

  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

class OptionalTrailing extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
  constructor(inputs: { source: IReadableClosure<number> }, _label = 'optional') {
    super(inputs);
  }

  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

class OptionalPrimitive extends BaseStateClosure<number, number> {
  constructor(inputs = 0) {
    super(inputs);
  }

  protected render() {
    const { inputs } = this;

    return ReactiveState.of(inputs);
  }
}

const FunctionComponent = () => <Empty />;

const KeyedValueMapper = ({ key }: { key: string }) => key;

describe('descriptor JSX runtime', () => {
  test('emits lazy descriptor tuples and builds the requested value type', () => {
    const source = MutableState.of(2);
    const policy: Policy = { format: String };

    Count.instances = 0;
    Root.instances = 0;

    const descriptor = (
      <Root
        child={<Count label={D('count')} source={source} />}
        key={D('root')}
        policy={D(policy)}
      />
    );

    expect(Count.instances).toBe(0);
    expect(Root.instances).toBe(0);
    expect(descriptor).toEqual([
      Root,
      {
        child: [Count, { label: D('count'), source }],
        key: D('root'),
        policy: D(policy),
      },
    ]);

    const closure = render<number>(descriptor);

    expectTypeOf(closure).toEqualTypeOf<IReadableClosure<number>>();
    expect(closure).toBeInstanceOf(Root);
    expect(closure.value.value).toBe(2);
    expect(Count.instances).toBe(1);
    expect(Root.instances).toBe(1);

    closure.destroy();
    source.destroy();
  });

  test('brands JSX descriptors with S and infers their built value type', () => {
    const source = MutableState.of(3);
    const descriptor = S<number>(<Count source={source} />);

    expectTypeOf(descriptor).toEqualTypeOf<JSXDescriptor<number>>();

    const closure = render(descriptor);

    expectTypeOf(closure).toEqualTypeOf<IReadableClosure<number>>();
    expect(closure.value.value).toBe(3);

    source.next(5);

    expect(closure.value.value).toBe(5);

    closure.destroy();
    source.destroy();
  });

  test('preserves D-wrapped class callbacks and their returned JSX descriptors', () => {
    const factory = render<RawFactory>(<FactoryReader create={D(createStringDescriptor)} />);

    const source = MutableState.of(42);
    const generatedDescriptor = factory.value.value.create(source);

    expect(factory.value.value.create).toBe(createStringDescriptor);

    expectTypeOf(generatedDescriptor).toEqualTypeOf<JSXDescriptor<string>>();

    expect(generatedDescriptor).toEqual([Formatted, { source }]);

    const generated = render(generatedDescriptor);

    expect(generated.value.value).toBe('42');

    source.next(7);

    expect(generated.value.value).toBe('7');

    generated.destroy();
    source.destroy();
    factory.destroy();
  });

  test('resolves descriptor generator props for functional state closures', () => {
    const factory = render<Factory>(
      <FunctionalFactory create={({ source }) => S<string>(<Formatted source={source} />)} />,
    );

    const source = render(S([(value: number) => value, 42]));
    const generated = factory.value.value.create({ source });

    expect(generated.value.value).toBe('42');

    source.destroy();
    factory.destroy();
  });

  test('builds JSX returned by render through the owned descriptor graph', () => {
    const source = MutableState.of(1);
    const destroyChild = vi.fn();

    class Tracked extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
      protected render() {
        const { source: input } = this.inputs;

        return input;
      }

      override destroy() {
        destroyChild();

        super.destroy();
      }
    }

    class JSXRender extends BaseStateClosure<number, { source: IReadableClosure<number> }> {
      protected render() {
        const { source: input } = this.inputs;

        return S<number>(<Tracked source={input} />);
      }
    }

    const closure = render(S([JSXRender, { source }]));

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
    const closure = render<'empty'>(<Empty />);

    expect(closure.value.value).toBe('empty');

    closure.destroy();
  });

  test('treats an omitted default object as empty JSX props', () => {
    const closure = render<string>(<DefaultObject />);

    expect(closure.value.value).toBe('empty');

    closure.destroy();
  });

  test('keeps exact descriptor types when the runtime is called directly', () => {
    const source = MutableState.of(1);
    const descriptor = jsx(Count, { source });

    expectTypeOf(descriptor[0]).toEqualTypeOf<typeof Count>();
    expect(descriptor).toEqual([Count, { source }]);

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
      child: <Count source={source} />,
      policy: D(policy),
    };
    const descriptor = <Root {...props} key={D('spread-root')} />;

    expect(descriptor).toEqual(
      createElement(Root, {
        ...props,
        key: D('spread-root'),
      }),
    );

    source.destroy();
  });

  test('lets a spread key override an earlier explicit key', () => {
    const source = MutableState.of(3);
    const policy: Policy = { format: String };
    const props = {
      child: <Count source={source} />,
      key: D('spread-key'),
      policy: D(policy),
    };
    // @ts-expect-error This intentionally verifies JSX's source-order key precedence.
    const descriptor = <Root key={D('explicit-key')} {...props} />;

    expect(descriptor).toEqual([Root, props]);

    source.destroy();
  });
});

const createGenericDescriptor = <
  C extends new (inputs: { source: IReadableClosure<number> }) => IReadableClosure<number>,
>(
  Closure: C,
  source: IReactiveState<number>,
) => <Closure source={source} />;

const _typecheckDescriptorJSX = () => {
  const source = MutableState.of(1);
  const Dynamic = source.value > 0 ? Count : StringSource;
  const policy = D<Policy>({ format: String });

  <Empty />;
  <Count source={source} />;
  <Generic<number> source={source} />;
  <OptionalObject source={source} />;
  <OptionalTrailing source={source} />;
  createGenericDescriptor(Count, source);

  jsx(OptionalTrailing, { source });
  jsx(Root, { child: source, policy }, 'root');
  jsx(KeyedValueMapper, {}, 'root');

  const descriptor = S<number>(<Count source={source} />);

  expectTypeOf(descriptor).toEqualTypeOf<JSXDescriptor<number>>();
  expectTypeOf<MappingDescriptorValue<typeof descriptor>>().toEqualTypeOf<number>();
  expectTypeOf(S(<Count source={source} />)).toMatchTypeOf<JSXDescriptor<unknown>>();
  expectTypeOf(render(descriptor)).toEqualTypeOf<IReadableClosure<number>>();
  expectTypeOf(render(<Count source={source} />)).toMatchTypeOf<IReadableClosure<unknown>>();
  expectTypeOf(render<number>(<Count source={source} />)).toEqualTypeOf<IReadableClosure<number>>();

  // Raw JSX has already erased its creator, so explicit value types are trusted.
  expectTypeOf(render<string>(<Count source={source} />)).toEqualTypeOf<IReadableClosure<string>>();
  expectTypeOf(render(Empty)).toEqualTypeOf<Empty>();
  expectTypeOf(render(S([Count, { source }]))).toEqualTypeOf<Count>();

  const directDescriptor = jsx(Count, { source });

  expectTypeOf(render(directDescriptor)).toEqualTypeOf<Count>();

  // @ts-expect-error Direct runtime calls retain their exact output value type.
  S<string>(directDescriptor);

  // @ts-expect-error Direct runtime calls retain their exact output value type.
  render<string>(directDescriptor);

  // @ts-expect-error A dynamic tag must be safe for every constructor branch.
  <Dynamic source={source} />;

  // @ts-expect-error A dynamic tag must be safe for every constructor branch.
  <Dynamic source={MutableState.of(true)} />;

  // @ts-expect-error Explicit generic arguments remain part of the prop contract.
  <Generic<number> source={MutableState.of('wrong')} />;

  // @ts-expect-error Required inputs stay required.
  <Count />;

  // @ts-expect-error Unknown inputs are rejected.
  <Count extra source={source} />;

  // @ts-expect-error Descriptor inputs preserve their source value type.
  <Count source={MutableState.of('wrong')} />;

  <Root
    // @ts-expect-error S preserves the nested descriptor's declared output type.
    child={S<string>(<Formatted source={source} />)}
    key={D('root')}
    policy={policy}
  />;

  <Root child={source} key="root" policy={policy} />;

  // @ts-expect-error Class callback inputs must be explicitly preserved as raw values.
  <FactoryReader create={() => 'wrong'} />;

  <Count label="count" source={source} />;

  // @ts-expect-error Static primitives cannot stand in for readable inputs.
  jsx(Root, { child: 1, policy }, 'root');

  // @ts-expect-error Positional inputs are intentionally unsupported in JSX.
  <Positional />;

  // @ts-expect-error Optional input objects keep their required fields in JSX.
  <OptionalObject />;

  // @ts-expect-error Multiple constructor parameters are intentionally unsupported in JSX.
  <MultipleParameters />;

  // @ts-expect-error Primitive constructor inputs are unsupported even when defaulted.
  <OptionalPrimitive />;

  // @ts-expect-error Void-input closures do not accept props.
  <Empty extra />;

  <FunctionComponent />;

  // @ts-expect-error Intrinsic JSX tags are not descriptor nodes.
  <div />;
};

void _typecheckDescriptorJSX;
