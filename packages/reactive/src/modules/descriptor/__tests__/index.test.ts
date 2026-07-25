import { Subscription } from 'rxjs';
import { beforeEach, describe, expect, expectTypeOf, test } from 'vitest';

import {
  BaseStateClosure,
  buildDescriptor,
  D,
  type DescriptorParameter,
  type IReactiveState,
  MutableState,
  ReactiveState,
  S,
  type StateSource,
} from '../..';

class ConfigStateClosure extends BaseStateClosure<'config'> {
  constructor() {
    super({ source: 'config' });
  }
}

type SecondStateClosureParams = {
  config: IReactiveState<'config'>;
};

class SecondStateClosure extends BaseStateClosure<'first'> {
  static readonly instances: SecondStateClosure[] = [];

  constructor(readonly params: SecondStateClosureParams) {
    super({ source: 'first' });

    SecondStateClosure.instances.push(this);
  }
}

class SecondLeafStateClosure extends BaseStateClosure<'second'> {
  constructor() {
    super({ source: 'second' });
  }
}

class ThirdStateClosure extends BaseStateClosure<'third'> {
  static readonly instances: ThirdStateClosure[] = [];

  constructor() {
    super({ source: 'third' });

    ThirdStateClosure.instances.push(this);
  }
}

type ForthStateClosureParams = {
  test: IReactiveState<'forth-param'>;
};

class ForthStateClosure extends BaseStateClosure<'forth'> {
  static readonly instances: ForthStateClosure[] = [];

  constructor(readonly params: ForthStateClosureParams) {
    super({ source: 'forth' });

    ForthStateClosure.instances.push(this);
  }
}

class FifthSubStateClosure extends BaseStateClosure<'fifth-sub'> {
  static readonly instances: FifthSubStateClosure[] = [];

  constructor(readonly param: IReactiveState<'fifth-param'>) {
    super({ source: 'fifth-sub' });

    FifthSubStateClosure.instances.push(this);
  }
}

type FifthStateClosureParams = {
  test: IReactiveState<'fifth-sub'>;
};

class FifthStateClosure extends BaseStateClosure<'fifth'> {
  static readonly instances: FifthStateClosure[] = [];

  constructor(readonly params: FifthStateClosureParams) {
    super({ source: 'fifth' });

    FifthStateClosure.instances.push(this);
  }
}

type SixthStateClosureParams = {
  test1: IReactiveState<'sixth-param-1'>;
  test2: IReactiveState<'sixth-param-2'>;
};

class SixthStateClosure extends BaseStateClosure<'sixth'> {
  static readonly instances: SixthStateClosure[] = [];

  constructor(readonly params: SixthStateClosureParams) {
    super({ source: 'sixth' });

    SixthStateClosure.instances.push(this);
  }
}

type SeventhSubClosureParams = {
  test2: IReactiveState<'seventh-sub-param'>;
};

class SeventhSubClosure extends BaseStateClosure<'seventh-sub'> {
  static readonly instances: SeventhSubClosure[] = [];

  constructor(readonly params: SeventhSubClosureParams) {
    super({ source: 'seventh-sub' });

    SeventhSubClosure.instances.push(this);
  }
}

type SeventhStateClosureParams = {
  test1: IReactiveState<'seventh-param'>;
  test2: (subParamState: IReactiveState<'seventh-sub-param'>) => IReactiveState<'seventh-sub'>;
};

class SeventhStateClosure extends BaseStateClosure<'seventh'> {
  static readonly instances: SeventhStateClosure[] = [];

  constructor(readonly params: SeventhStateClosureParams) {
    super({ source: 'seventh' });

    SeventhStateClosure.instances.push(this);
  }
}

type FirstStateClosureParams = {
  first: IReactiveState<'first'>;
  second: IReactiveState<'second'>;
  third: IReactiveState<'third'>;
  forth: (paramState: IReactiveState<'forth-param'>) => IReactiveState<'forth'>;
  fifth: (paramState: IReactiveState<'fifth-param'>) => IReactiveState<'fifth'>;
  sixth: (params: {
    param1State: IReactiveState<'sixth-param-1'>;
    param2State: IReactiveState<'sixth-param-2'>;
  }) => IReactiveState<'sixth'>;
  seventh: (paramState: IReactiveState<'seventh-param'>) => IReactiveState<'seventh'>;
  eighth: number[];
};

class FirstStateClosure extends BaseStateClosure<'root'> {
  constructor(readonly params: FirstStateClosureParams) {
    super({ source: 'root' });
  }
}

const constantFunction = () => 'constant';

class ConstantClass {
  readonly value = 'constant';
}

type AdditionalStateClosureParams = {
  zero: () => IReactiveState<'third'>;
  pair: (
    param1State: IReactiveState<'sixth-param-1'>,
    param2State: IReactiveState<'sixth-param-2'>,
  ) => IReactiveState<'sixth'>;
  constantFunction: typeof constantFunction;
  constantClass: typeof ConstantClass;
};

class AdditionalStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: AdditionalStateClosureParams) {
    super({ source: null });
  }
}

type LifecycleStateClosureParams = {
  name: string;
};

class LifecycleStateClosure extends BaseStateClosure<string> {
  static readonly destroyedNames: string[] = [];

  static readonly instances: LifecycleStateClosure[] = [];

  constructor(readonly params: LifecycleStateClosureParams) {
    super({ source: params.name });

    LifecycleStateClosure.instances.push(this);
  }

  override destroy() {
    LifecycleStateClosure.destroyedNames.push(this.params.name);

    super.destroy();
  }
}

type LifecycleRootStateClosureParams = {
  external?: IReactiveState<string>;
  first: IReactiveState<string>;
  second: IReactiveState<string>;
};

class LifecycleRootStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: LifecycleRootStateClosureParams) {
    super({ source: null });
  }
}

type GeneratorRootStateClosureParams = {
  getChild(): IReactiveState<string>;
};

class GeneratorRootStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: GeneratorRootStateClosureParams) {
    super({ source: null });
  }
}

type PairGeneratorRootStateClosureParams = {
  create(params: {
    first: IReactiveState<string>;
    second: IReactiveState<string>;
  }): IReactiveState<string>;
};

class PairGeneratorRootStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: PairGeneratorRootStateClosureParams) {
    super({ source: null });
  }
}

class ThrowingRootStateClosure extends BaseStateClosure<null> {
  constructor(_params: { child: IReactiveState<string> }) {
    super({ source: null });

    throw new Error('Failed to construct the descriptor root.');
  }
}

class ImmediateValueStateClosure extends BaseStateClosure<unknown> {
  constructor(readonly input: unknown) {
    super({ source: input });
  }
}

type ValueGeneratorRootStateClosureParams = {
  create(value: unknown): IReactiveState<unknown>;
};

class ValueGeneratorRootStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: ValueGeneratorRootStateClosureParams) {
    super({ source: null });
  }
}

const configState = new ConfigStateClosure();
const secondState = new SecondLeafStateClosure();
const immediate = [1, 2, 3];

const descriptor = S([
  FirstStateClosure,
  {
    first: S([SecondStateClosure, { config: configState }]),
    second: secondState,
    third: ThirdStateClosure,
    forth: (paramState) => {
      expectTypeOf(paramState).toEqualTypeOf<DescriptorParameter<IReactiveState<'forth-param'>>>();

      return S([ForthStateClosure, { test: paramState }]);
    },
    fifth: (paramState) => {
      expectTypeOf(paramState).toEqualTypeOf<DescriptorParameter<IReactiveState<'fifth-param'>>>();

      return S([FifthStateClosure, { test: S([FifthSubStateClosure, paramState]) }]);
    },
    sixth: ({ param1State, param2State }) => {
      expectTypeOf(param1State).toEqualTypeOf<
        DescriptorParameter<IReactiveState<'sixth-param-1'>>
      >();
      expectTypeOf(param2State).toEqualTypeOf<
        DescriptorParameter<IReactiveState<'sixth-param-2'>>
      >();

      return [SixthStateClosure, { test1: param1State, test2: param2State }];
    },
    seventh: (paramState) => {
      expectTypeOf(paramState).toEqualTypeOf<
        DescriptorParameter<IReactiveState<'seventh-param'>>
      >();

      return [
        SeventhStateClosure,
        {
          test1: paramState,
          test2: (subParamState: DescriptorParameter<IReactiveState<'seventh-sub-param'>>) => {
            expectTypeOf(subParamState).toEqualTypeOf<
              DescriptorParameter<IReactiveState<'seventh-sub-param'>>
            >();

            return S([SeventhSubClosure, { test2: subParamState }]);
          },
        },
      ];
    },
    eighth: D(immediate),
  },
]);

const additionalDescriptor = S([
  AdditionalStateClosure,
  {
    zero: () => ThirdStateClosure,
    pair: (param1State, param2State) => {
      expectTypeOf(param1State).toEqualTypeOf<
        DescriptorParameter<IReactiveState<'sixth-param-1'>>
      >();
      expectTypeOf(param2State).toEqualTypeOf<
        DescriptorParameter<IReactiveState<'sixth-param-2'>>
      >();

      return [SixthStateClosure, { test1: param1State, test2: param2State }];
    },
    constantFunction: D(constantFunction),
    constantClass: D(ConstantClass),
  },
]);

const _typecheckSlottedNestedGenerator = (
  paramState: DescriptorParameter<IReactiveState<'seventh-param'>>,
) =>
  S([
    SeventhStateClosure,
    {
      test1: paramState,
      test2: (subParamState) => {
        expectTypeOf(subParamState).toEqualTypeOf<
          DescriptorParameter<IReactiveState<'seventh-sub-param'>>
        >();

        return S([SeventhSubClosure, { test2: subParamState }]);
      },
    },
  ]);

const trackedInstances = [
  SecondStateClosure.instances,
  ThirdStateClosure.instances,
  ForthStateClosure.instances,
  FifthSubStateClosure.instances,
  FifthStateClosure.instances,
  SixthStateClosure.instances,
  SeventhSubClosure.instances,
  SeventhStateClosure.instances,
  LifecycleStateClosure.instances,
];

beforeEach(() => {
  for (const instances of trackedInstances) {
    instances.splice(0);
  }

  LifecycleStateClosure.destroyedNames.splice(0);
});

describe('descriptor', () => {
  test('keeps S as an identity and builds static descriptor nodes', () => {
    const slotted: [typeof SecondStateClosure, { config: ConfigStateClosure }] = [
      SecondStateClosure,
      { config: configState },
    ];
    const existing = buildDescriptor(secondState);
    const raw = buildDescriptor(ConfigStateClosure);

    expect(S(slotted)).toBe(slotted);
    expectTypeOf(existing).toEqualTypeOf<SecondLeafStateClosure>();
    expectTypeOf(raw).toEqualTypeOf<ConfigStateClosure>();
    expect(existing).toBe(secondState);
    expect(raw).toBeInstanceOf(ConfigStateClosure);

    const closure = buildDescriptor(descriptor);
    const first = SecondStateClosure.instances[0];
    const third = ThirdStateClosure.instances[0];

    expectTypeOf(closure).toEqualTypeOf<FirstStateClosure>();
    expect(closure).toBeInstanceOf(FirstStateClosure);
    expect(first?.params.config).toBe(configState.value);
    expect(closure.params.first).toBe(first?.value);
    expect(closure.params.second).toBe(secondState.value);
    expect(closure.params.third).toBe(third?.value);
    expect(closure.params.eighth).toBe(immediate);
  });

  test('lazily builds recursive generator descriptors', () => {
    const closure = buildDescriptor(descriptor);

    expect(ForthStateClosure.instances).toHaveLength(0);
    expect(FifthStateClosure.instances).toHaveLength(0);
    expect(SixthStateClosure.instances).toHaveLength(0);
    expect(SeventhStateClosure.instances).toHaveLength(0);

    const forthParam = ReactiveState.of<'forth-param'>('forth-param');
    const forth = closure.params.forth(forthParam);
    const forthClosure = ForthStateClosure.instances[0];

    expect(forthClosure?.params.test).toBe(forthParam);
    expect(forth).toBe(forthClosure?.value);

    const nextForth = closure.params.forth(forthParam);

    expect(ForthStateClosure.instances).toHaveLength(2);
    expect(nextForth).not.toBe(forth);

    const fifthParam = ReactiveState.of<'fifth-param'>('fifth-param');
    const fifth = closure.params.fifth(fifthParam);
    const fifthSubClosure = FifthSubStateClosure.instances[0];
    const fifthClosure = FifthStateClosure.instances[0];

    expect(fifthSubClosure?.param).toBe(fifthParam);
    expect(fifthClosure?.params.test).toBe(fifthSubClosure?.value);
    expect(fifth).toBe(fifthClosure?.value);

    const sixthParam1 = ReactiveState.of<'sixth-param-1'>('sixth-param-1');
    const sixthParam2 = ReactiveState.of<'sixth-param-2'>('sixth-param-2');
    const sixth = closure.params.sixth({
      param1State: sixthParam1,
      param2State: sixthParam2,
    });
    const sixthClosure = SixthStateClosure.instances[0];

    expect(sixthClosure?.params.test1).toBe(sixthParam1);
    expect(sixthClosure?.params.test2).toBe(sixthParam2);
    expect(sixth).toBe(sixthClosure?.value);

    const seventhParam = ReactiveState.of<'seventh-param'>('seventh-param');
    const seventh = closure.params.seventh(seventhParam);
    const seventhClosure = SeventhStateClosure.instances[0];

    expect(seventhClosure?.params.test1).toBe(seventhParam);
    expect(seventh).toBe(seventhClosure?.value);
    expect(SeventhSubClosure.instances).toHaveLength(0);

    const seventhSubParam = ReactiveState.of<'seventh-sub-param'>('seventh-sub-param');
    const seventhSub = seventhClosure?.params.test2(seventhSubParam);
    const seventhSubClosure = SeventhSubClosure.instances[0];

    expect(seventhSubClosure?.params.test2).toBe(seventhSubParam);
    expect(seventhSub).toBe(seventhSubClosure?.value);
  });

  test('supports positional generators and immediate function values', () => {
    const closure = buildDescriptor(additionalDescriptor);

    expect(closure.params.constantFunction).toBe(constantFunction);
    expect(closure.params.constantClass).toBe(ConstantClass);
    expect(ThirdStateClosure.instances).toHaveLength(0);
    expect(SixthStateClosure.instances).toHaveLength(0);

    const zero = closure.params.zero();
    const zeroClosure = ThirdStateClosure.instances[0];

    expect(zero).toBe(zeroClosure?.value);

    const param1State = ReactiveState.of<'sixth-param-1'>('sixth-param-1');
    const param2State = ReactiveState.of<'sixth-param-2'>('sixth-param-2');
    const pair = closure.params.pair(param1State, param2State);
    const pairClosure = SixthStateClosure.instances[0];

    expect(pairClosure?.params.test1).toBe(param1State);
    expect(pairClosure?.params.test2).toBe(param2State);
    expect(pair).toBe(pairClosure?.value);
  });

  test('cleans internal generator nodes without destroying external closures', () => {
    const external = new LifecycleStateClosure({ name: 'external' });
    const generated = S([LifecycleStateClosure, D({ name: 'generated' })]);
    const root = buildDescriptor(
      S([
        GeneratorRootStateClosure,
        {
          getChild: () => generated,
        },
      ]),
    );
    const first = root.params.getChild();
    const second = root.params.getChild();
    const externalRoot = buildDescriptor(
      S([
        LifecycleRootStateClosure,
        {
          external,
          first: external,
          second: external,
        },
      ]),
    );

    expect(first).not.toBe(second);
    expect(LifecycleStateClosure.instances).toHaveLength(3);

    root.destroy();
    externalRoot.destroy();

    expect(LifecycleStateClosure.destroyedNames).toEqual(['generated', 'generated']);
    expect(external.value.closed).toBe(false);
    expect(() => root.params.getChild()).toThrow('destroyed descriptor graph');

    external.destroy();
  });

  test('destroys unopened mapped roots without starting their source', () => {
    let mapperCalls = 0;

    let sourceSubscriptions = 0;

    const source: IReactiveState<number> = {
      value: 1,
      closed: false,
      subscribe: () => {
        sourceSubscriptions += 1;

        return new Subscription();
      },
    };
    const mapped = buildDescriptor(
      S([
        ({ child, value }: { child: string; value: number }) => {
          mapperCalls += 1;

          return `${child}:${value}`;
        },
        {
          child: S([LifecycleStateClosure, D({ name: 'mapped-child' })]),
          value: source,
        },
      ]),
    );

    mapped.destroy();

    expect(mapperCalls).toBe(0);
    expect(sourceSubscriptions).toBe(0);
    expect(source.closed).toBe(false);
    expect(LifecycleStateClosure.destroyedNames).toEqual(['mapped-child']);
    expect(() => mapped.value).toThrowError('Cannot set up a destroyed state closure.');
  });

  test('waits for every live generator input and releases immediately on input errors', () => {
    const root = buildDescriptor(
      S([
        PairGeneratorRootStateClosure,
        {
          create: ({ first, second: _second }) =>
            S([LifecycleStateClosure, D({ name: first.value })]),
        },
      ]),
    );
    const first = MutableState.of('all-complete');
    const second = MutableState.of('second');
    const completed = root.params.create({ first, second });

    first.complete();

    expect(completed.closed).toBe(false);
    expect(LifecycleStateClosure.destroyedNames).toEqual([]);

    second.complete();

    expect(completed.closed).toBe(true);
    expect(LifecycleStateClosure.destroyedNames).toEqual(['all-complete']);

    const failing = MutableState.of('error');
    const stillOpen = MutableState.of('still-open');
    const errored = root.params.create({ first: failing, second: stillOpen });

    failing.error(new Error('Expected generator input failure.'));

    expect(errored.closed).toBe(true);
    expect(LifecycleStateClosure.destroyedNames).toEqual(['all-complete', 'error']);
    expect(stillOpen.closed).toBe(false);

    root.destroy();

    expect(LifecycleStateClosure.destroyedNames).toEqual(['all-complete', 'error']);
    expect(stillOpen.closed).toBe(false);

    stillOpen.complete();
  });

  test('stops subscribing generator inputs after synchronous termination', () => {
    const root = buildDescriptor(
      S([
        PairGeneratorRootStateClosure,
        {
          create: ({ first, second: _second }) =>
            S([LifecycleStateClosure, D({ name: first.value })]),
        },
      ]),
    );
    const reason = new Error('Expected synchronous generator input failure.');
    const first: IReactiveState<string> = {
      value: 'sync-error',
      closed: false,
      subscribe: (subscriber) => {
        if (typeof subscriber !== 'function') {
          subscriber.error?.(reason);
        }

        const subscription = new Subscription();

        subscription.unsubscribe();

        return subscription;
      },
    };
    let secondSubscriptions = 0;
    const second: IReactiveState<string> = {
      value: 'still-open',
      closed: false,
      subscribe: () => {
        secondSubscriptions += 1;

        return new Subscription();
      },
    };
    const errored = root.params.create({ first, second });

    expect(errored.closed).toBe(true);
    expect(secondSubscriptions).toBe(0);
    expect(LifecycleStateClosure.destroyedNames).toEqual(['sync-error']);

    root.destroy();
  });

  test('cleans children if root construction fails', () => {
    expect(() =>
      buildDescriptor(
        S([
          ThrowingRootStateClosure,
          {
            child: S([LifecycleStateClosure, D({ name: 'constructed-before-error' })]),
          },
        ]),
      ),
    ).toThrow('Failed to construct the descriptor root.');

    expect(LifecycleStateClosure.destroyedNames).toEqual(['constructed-before-error']);
  });

  test.each([() => 'function', new Date(0), new Map()])(
    'requires D() around non-plain mapping constants',
    (constant) => {
      const invalidDescriptor = [(value: unknown) => value, constant] as never;

      expect(() => buildDescriptor(invalidDescriptor)).toThrow(
        'Invalid mapping descriptor. Wrap constant values with D().',
      );

      const mapped = buildDescriptor(S([(value: unknown) => value, D(constant)]));

      expect(mapped.value.value).toBe(constant);

      mapped.destroy();
    },
  );

  test.each([new Date(0), new Map(), new ConstantClass()])(
    'requires D() around non-plain constructor parameters',
    (constant) => {
      const invalidDescriptor = [ImmediateValueStateClosure, constant] as never;

      expect(() => buildDescriptor(invalidDescriptor)).toThrow(
        'Invalid descriptor. Wrap immediate values with D().',
      );

      const closure = buildDescriptor(S([ImmediateValueStateClosure, D(constant)]));

      expect(closure.input).toBe(constant);

      closure.destroy();
    },
  );

  test('keeps non-plain generator arguments immediate', () => {
    const root = buildDescriptor(
      S([
        ValueGeneratorRootStateClosure,
        {
          create: (value) => S([ImmediateValueStateClosure, value]),
        },
      ]),
    );
    const date = new Date(0);
    const value = root.params.create(date);

    expect(value.value).toBe(date);

    root.destroy();
  });

  test('accepts direct constructor, mapping, and generator results', () => {
    expectTypeOf<StateSource<IReactiveState<number>>>().toEqualTypeOf<IReactiveState<number>>();

    const array = buildDescriptor(S([ImmediateArrayStateClosure, [1, 2, 3]]));

    const mapped = buildDescriptor(S([({ value }: { value: number }) => value * 2, { value: 2 }]));

    const direct = buildDescriptor(
      S([
        StateSourceStateClosure,
        {
          source: 1,
          create: () => 2,
          forward: (input) => input,
        },
      ]),
    );

    const source = ReactiveState.of(3);

    const sourceClosure = new BaseStateClosure({ source: 4 });

    const reactive = buildDescriptor(
      S([
        StateSourceStateClosure,
        {
          source,
          create: () => source,
          forward: (input) => input,
        },
      ]),
    );

    expect(array.params).toEqual([1, 2, 3]);

    expect(mapped.value.value).toBe(4);

    expect(direct.params.source).toBe(1);

    expect(direct.params.create()).toBe(2);

    expect(direct.params.forward(sourceClosure)).toBe(sourceClosure.value);

    expect(reactive.params.source).toBe(source);

    expect(reactive.params.create()).toBe(source);

    array.destroy();

    mapped.destroy();

    direct.destroy();

    reactive.destroy();

    sourceClosure.destroy();
  });
});

class InvalidStateSlotClosure extends BaseStateClosure<null> {
  constructor(_params: { state: IReactiveState<number> }) {
    super({ source: null });
  }
}

class InvalidGeneratorSlotClosure extends BaseStateClosure<null> {
  constructor(_params: { create: (state: IReactiveState<'input'>) => IReactiveState<'output'> }) {
    super({ source: null });
  }
}

class NumberStateClosure extends BaseStateClosure<number> {
  constructor() {
    super({ source: 1 });
  }
}

class WrongOutputStateClosure extends BaseStateClosure<'wrong-output'> {
  constructor() {
    super({ source: 'wrong-output' });
  }
}

class ImmediateArrayStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: number[]) {
    super({ source: null });
  }
}

type StateSourceStateClosureParams = {
  create(): StateSource<number>;
  forward(source: StateSource<number>): StateSource<number>;
  source: StateSource<number>;
};

class StateSourceStateClosure extends BaseStateClosure<null> {
  constructor(readonly params: StateSourceStateClosureParams) {
    super({ source: null });
  }
}

const _typecheckInvalidDescriptors = () => {
  // @ts-expect-error The slot requires a number-valued state.
  S([InvalidStateSlotClosure, { state: ThirdStateClosure }]);

  // @ts-expect-error A class with constructor params cannot be used as a raw class leaf.
  S([InvalidStateSlotClosure, { state: SecondStateClosure }]);

  // @ts-expect-error The generated descriptor must produce the declared output state.
  S([InvalidGeneratorSlotClosure, { create: (_state) => WrongOutputStateClosure }]);

  // @ts-expect-error Strict state slots do not accept direct values.
  S([InvalidStateSlotClosure, { state: 1 }]);

  // @ts-expect-error Strict state generators do not return direct values.
  S([InvalidGeneratorSlotClosure, { create: () => 'output' }]);

  S([ImmediateArrayStateClosure, [1, 2, 3]]);

  S([InvalidStateSlotClosure, { state: NumberStateClosure }]);
};

const _typecheckMappedDescriptors = () => {
  const source = ReactiveState.of(1);
  const label = ReactiveState.of('item');

  const compared = S([
    ({ value }: { value: number }) => ({ value }),
    { value: source },
    (left, right) => {
      expectTypeOf(left).toEqualTypeOf<{ value: number }>();
      expectTypeOf(right).toEqualTypeOf<{ value: number }>();

      return left.value === right.value;
    },
  ]);

  S([({ value }: { value: number }) => value * 2, { value: source }]);
  S([({ state }: { state: IReactiveState<number> }) => state.value, { state: D(source) }]);
  S([(value: 'third') => value, ThirdStateClosure]);
  S([([value, name]: readonly [number, string]) => `${name}-${value}`, [source, label]]);
  S([({ value }: { value: number }) => value, compared]);

  S([({ value }: { value: number }) => value, { value: 1 }]);

  // @ts-expect-error The distinctor inputs must match the mapper result.
  S([({ value }: { value: number }) => value, { value: source }, (_a: string, _b: string) => true]);

  // @ts-expect-error The mapper input must match the reactive descriptor value.
  S([({ value }: { value: string }) => value, { value: source }]);

  // @ts-expect-error State closure classes with required parameters must use a slotted descriptor.
  S([(value: 'first') => value, SecondStateClosure]);
};
