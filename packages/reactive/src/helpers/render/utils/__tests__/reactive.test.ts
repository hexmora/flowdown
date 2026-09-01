import { round } from 'lodash-es';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import {
  BaseStateClosure,
  BatchScheduler,
  combineMapState,
  D,
  type IReactiveState,
  type IStateClosure,
  MutableState,
  render,
  S,
  type StateClosureSource,
} from '../../../..';

type SourceStateClosureInputs<T> = {
  source: StateClosureSource<T>;
};

class SourceStateClosure<T> extends BaseStateClosure<T, SourceStateClosureInputs<T>> {
  protected render() {
    const { source } = this.inputs;

    return source;
  }
}

type CheckoutPolicy = {
  currency: string;
  shipping: number;
  round(value: number): number;
};

type SubtotalStateClosureInputs = {
  quantity: IReactiveState<number>;
  unitPrice: IReactiveState<number>;
};

class SubtotalStateClosure extends BaseStateClosure<number, SubtotalStateClosureInputs> {
  protected render() {
    const { quantity, unitPrice } = this.inputs;

    return combineMapState([quantity, unitPrice], ([count, price]) => count * price);
  }
}

class TaxRateStateClosure extends BaseStateClosure<number> {
  static source = MutableState.of(0);

  static instances = 0;

  constructor() {
    super();

    TaxRateStateClosure.instances += 1;
  }

  protected render() {
    return TaxRateStateClosure.source;
  }
}

type Checkout = {
  currency: string;
  subtotal: number;
  total: number;
};

type CheckoutStateClosureInputs = {
  policy: CheckoutPolicy;
  subtotal: IReactiveState<number>;
  taxRate: IReactiveState<number>;
};

class CheckoutStateClosure extends BaseStateClosure<Checkout, CheckoutStateClosureInputs> {
  protected render() {
    const { policy, subtotal, taxRate } = this.inputs;

    return combineMapState([subtotal, taxRate], ([currentSubtotal, currentTaxRate]) => ({
      currency: policy.currency,
      subtotal: currentSubtotal,
      total: policy.round(currentSubtotal * (1 + currentTaxRate) + policy.shipping),
    }));
  }
}

type QuotePolicy = {
  channel: string;
  fee: number;
  round(value: number): number;
};

type Quote = {
  amount: number;
  channel: string;
  quantity: number;
};

type QuoteStateClosureInputs = {
  discount: IReactiveState<number>;
  policy: QuotePolicy;
  quantity: IReactiveState<number>;
  unitPrice: IReactiveState<number>;
};

class QuoteStateClosure extends BaseStateClosure<Quote, QuoteStateClosureInputs> {
  static instances = 0;

  constructor(inputs: QuoteStateClosureInputs) {
    super(inputs);

    QuoteStateClosure.instances += 1;
  }

  protected render() {
    const { discount, policy, quantity, unitPrice } = this.inputs;

    return combineMapState([unitPrice, quantity, discount], ([price, count, currentDiscount]) => ({
      amount: policy.round(price * count * (1 - currentDiscount) + policy.fee),
      channel: policy.channel,
      quantity: count,
    }));
  }
}

type QuoteFactory = {
  createQuote(params: {
    discount: IReactiveState<number>;
    quantity: IReactiveState<number>;
  }): IReactiveState<Quote>;
};

class QuoteFactoryStateClosure extends BaseStateClosure<QuoteFactory, QuoteFactory> {
  protected render() {
    const { inputs } = this;

    return inputs;
  }
}

type MappingFactory = {
  create(source: IReactiveState<number>): IReactiveState<number>;
};

class MappingFactoryStateClosure extends BaseStateClosure<MappingFactory, MappingFactory> {
  protected render() {
    const { inputs } = this;

    return inputs;
  }
}

const roundCurrency = (value: number) => round(value * 100) / 100;

describe('reactive descriptors', () => {
  test('propagates source changes through instance, class, slotted, and immediate nodes', () => {
    const unitPriceSource = MutableState.of(10);
    const quantitySource = MutableState.of(2);

    const unitPriceState = new SourceStateClosure({ source: unitPriceSource });

    const quantityState = new SourceStateClosure({ source: quantitySource });

    const policy: CheckoutPolicy = {
      currency: 'USD',
      shipping: 5,
      round: roundCurrency,
    };

    TaxRateStateClosure.source = MutableState.of(0.1);
    TaxRateStateClosure.instances = 0;

    const checkout = render(
      S([
        CheckoutStateClosure,
        {
          policy: D(policy),
          subtotal: S([
            SubtotalStateClosure,
            { quantity: quantityState, unitPrice: unitPriceState },
          ]),
          taxRate: TaxRateStateClosure,
        },
      ]),
    );
    const next = vi.fn();

    checkout.value.subscribe(next);

    expect(TaxRateStateClosure.instances).toBe(1);

    expect(checkout.inputs.policy).toBe(policy);

    expect(next.mock.calls).toEqual([[{ currency: 'USD', subtotal: 20, total: 27 }]]);

    next.mockClear();
    unitPriceSource.next(12);

    expect(checkout.value.value).toEqual({ currency: 'USD', subtotal: 24, total: 31.4 });
    expect(next.mock.calls).toEqual([[{ currency: 'USD', subtotal: 24, total: 31.4 }]]);

    next.mockClear();

    BatchScheduler.batch(() => {
      quantitySource.next(3);
      TaxRateStateClosure.source.next(0.2);

      expect(next).not.toHaveBeenCalled();
    });

    expect(checkout.value.value).toEqual({ currency: 'USD', subtotal: 36, total: 48.2 });
    expect(next.mock.calls).toEqual([[{ currency: 'USD', subtotal: 36, total: 48.2 }]]);
  });

  test('creates independent reactive graphs from a descriptor generator', () => {
    const unitPriceSource = MutableState.of(20);

    const unitPriceState = new SourceStateClosure({ source: unitPriceSource });

    const policy: QuotePolicy = {
      channel: 'web',
      fee: 2,
      round: roundCurrency,
    };
    const factory = render(
      S([
        QuoteFactoryStateClosure,
        {
          createQuote: ({ discount, quantity }) =>
            S([
              QuoteStateClosure,
              {
                discount,
                policy: D(policy),
                quantity,
                unitPrice: unitPriceState,
              },
            ]),
        },
      ]),
    );
    const quantityA = MutableState.of(2);
    const discountA = MutableState.of(0.1);
    const quantityB = MutableState.of(1);
    const discountB = MutableState.of(0);

    QuoteStateClosure.instances = 0;

    const createQuote = factory.value.value.createQuote;

    expect(QuoteStateClosure.instances).toBe(0);

    const quoteA = createQuote({ discount: discountA, quantity: quantityA });
    const quoteB = createQuote({ discount: discountB, quantity: quantityB });
    const nextA = vi.fn();
    const nextB = vi.fn();

    quoteA.subscribe(nextA);
    quoteB.subscribe(nextB);

    expect(QuoteStateClosure.instances).toBe(2);
    expect(quoteA).not.toBe(quoteB);
    expect(nextA.mock.calls).toEqual([[{ amount: 38, channel: 'web', quantity: 2 }]]);
    expect(nextB.mock.calls).toEqual([[{ amount: 22, channel: 'web', quantity: 1 }]]);

    nextA.mockClear();
    nextB.mockClear();
    quantityA.next(3);

    expect(quoteA.value).toEqual({ amount: 56, channel: 'web', quantity: 3 });
    expect(nextA).toHaveBeenCalledOnce();
    expect(nextA).toHaveBeenCalledWith({ amount: 56, channel: 'web', quantity: 3 });
    expect(nextB).not.toHaveBeenCalled();

    nextA.mockClear();
    unitPriceSource.next(25);

    expect(nextA.mock.calls).toEqual([[{ amount: 69.5, channel: 'web', quantity: 3 }]]);
    expect(nextB.mock.calls).toEqual([[{ amount: 27, channel: 'web', quantity: 1 }]]);

    nextA.mockClear();
    nextB.mockClear();
    discountA.next(0.2);

    expect(quoteA.value).toEqual({ amount: 62, channel: 'web', quantity: 3 });
    expect(nextA).toHaveBeenCalledOnce();
    expect(nextA).toHaveBeenCalledWith({ amount: 62, channel: 'web', quantity: 3 });
    expect(nextB).not.toHaveBeenCalled();
  });

  test('maps recursive reactive inputs and suppresses deeply equal results', () => {
    const quantity = MutableState.of(2);
    const unitPrice = MutableState.of(10);
    const discount = MutableState.of(0);
    const mapper = vi.fn(
      ({
        pricing: { currentDiscount, currentUnitPrice },
        currentQuantity,
        currency,
      }: {
        pricing: { currentDiscount: number; currentUnitPrice: number };
        currentQuantity: number;
        currency: string;
      }) => ({
        amount: roundCurrency(currentQuantity * currentUnitPrice * (1 - currentDiscount)),
        currency,
      }),
    );
    const descriptor = S([
      mapper,
      {
        pricing: {
          currentDiscount: discount,
          currentUnitPrice: unitPrice,
        },
        currentQuantity: quantity,
        currency: D('USD'),
      },
    ]);
    const mapped = render(descriptor);
    const next = vi.fn();

    expectTypeOf(mapped).toEqualTypeOf<
      IStateClosure<{
        amount: number;
        currency: string;
      }>
    >();

    expect(mapper).not.toHaveBeenCalled();

    mapped.value.subscribe(next);

    const initialCalls = mapper.mock.calls.length;

    expect(initialCalls).toBeGreaterThan(0);
    expect(next.mock.calls).toEqual([[{ amount: 20, currency: 'USD' }]]);

    next.mockClear();
    quantity.next(3);
    unitPrice.next(8);

    expect(mapped.value.value).toEqual({ amount: 24, currency: 'USD' });
    expect(mapper).toHaveBeenCalledTimes(initialCalls + 2);
    expect(next.mock.calls).toEqual([
      [{ amount: 30, currency: 'USD' }],
      [{ amount: 24, currency: 'USD' }],
    ]);

    next.mockClear();
    discount.next(0);

    expect(mapper).toHaveBeenCalledTimes(initialCalls + 2);
    expect(next).not.toHaveBeenCalled();

    mapped.destroy();
    quantity.next(4);

    expect(mapper).toHaveBeenCalledTimes(initialCalls + 2);
    expect(quantity.closed).toBe(false);
    expect(unitPrice.closed).toBe(false);
    expect(discount.closed).toBe(false);
  });

  test('uses Object.is for mapped results by default', () => {
    const source = MutableState.of(1);
    const mapped = render(
      S([
        ({ value }: { value: number }) => {
          expectTypeOf(value).toEqualTypeOf<number>();

          return { parity: value % 2 };
        },
        { value: source },
      ]),
    );
    const next = vi.fn();

    mapped.value.subscribe(next);

    const initial = mapped.value.value;

    next.mockClear();

    source.next(3);

    expect(mapped.value.value).toEqual({ parity: 1 });
    expect(mapped.value.value).not.toBe(initial);
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenLastCalledWith({ parity: 1 });

    source.next(4);

    expect(next).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenLastCalledWith({ parity: 0 });
  });

  test('uses a custom distinctor for mapped results', () => {
    type Item = { key: string; value: number };

    const source = MutableState.of<Item>({ key: 'stable', value: 1 });
    const distinctor = vi.fn((left: Item, right: Item) => left.key === right.key);
    const mapped = render(S([(item: Item) => ({ ...item }), source, distinctor]));
    const next = vi.fn();

    mapped.value.subscribe(next);
    next.mockClear();
    distinctor.mockClear();

    source.next({ key: 'stable', value: 2 });

    expect(distinctor).toHaveBeenCalled();
    expect(mapped.value.value).toEqual({ key: 'stable', value: 1 });
    expect(next).not.toHaveBeenCalled();

    source.next({ key: 'changed', value: 2 });

    expect(mapped.value.value).toEqual({ key: 'changed', value: 2 });
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith({ key: 'changed', value: 2 });
  });

  test('composes mapped descriptors and keeps D-wrapped states constant', () => {
    const source = MutableState.of(2);
    const constantState = MutableState.of(10);
    const doubled = S([
      (value: number) => {
        expectTypeOf(value).toEqualTypeOf<number>();

        return value * 2;
      },
      source,
    ]);
    const mapper = vi.fn(
      ({ constant, current }: { constant: IReactiveState<number>; current: number }) => ({
        result: current + constant.value,
      }),
    );
    const mapped = render(
      S([
        mapper,
        {
          constant: D(constantState),
          current: doubled,
        },
      ]),
    );
    const next = vi.fn();

    mapped.value.subscribe(next);

    const initialCalls = mapper.mock.calls.length;

    expect(next.mock.calls).toEqual([[{ result: 14 }]]);

    next.mockClear();
    constantState.next(20);

    expect(mapper).toHaveBeenCalledTimes(initialCalls);
    expect(next).not.toHaveBeenCalled();

    source.next(3);

    expect(mapper).toHaveBeenCalledTimes(initialCalls + 1);
    expect(next).toHaveBeenCalledWith({ result: 26 });

    mapped.destroy();

    expect(source.closed).toBe(false);
    expect(constantState.closed).toBe(false);
  });

  test('keeps generator state parameters reactive inside mapped descriptors', () => {
    const factory = render(
      S([
        MappingFactoryStateClosure,
        {
          create: (source) => {
            expectTypeOf(source).toEqualTypeOf<IReactiveState<number>>();

            return S([(value: number) => value * 2, source]);
          },
        },
      ]),
    );
    const source = MutableState.of(2);
    const mapped = factory.value.value.create(source);
    const next = vi.fn();

    mapped.subscribe(next);

    expect(next.mock.calls).toEqual([[4]]);

    source.next(3);

    expect(next.mock.calls).toEqual([[4], [6]]);

    factory.destroy();
    source.next(4);

    expect(next.mock.calls).toEqual([[4], [6]]);
    expect(source.closed).toBe(false);
  });
});
