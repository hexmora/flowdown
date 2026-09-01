import { jsx } from 'reactive/jsx-runtime';
import { describe, expect, test } from 'vitest';

import { D, immediate, type IReactiveState, MutableState, render, S } from '../../..';

const mapper = ({ source }: { source: IReactiveState<number> }) => source;

const ImmediateMapper = /*#__PURE__*/ immediate(mapper);

describe('immediate', () => {
  test('types immediate inputs without changing runtime behavior', () => {
    const source = MutableState.of(1);

    const descriptor = S([ImmediateMapper, { source: D(source) }]);

    expect(ImmediateMapper).toBe(mapper);

    const closure = render(descriptor);

    expect(closure.value.value).toBe(1);

    source.next(2);

    expect(closure.value.value).toBe(2);

    closure.destroy();

    source.destroy();
  });
});

const _typecheckImmediateJSX = () => {
  const source = MutableState.of(1);

  <ImmediateMapper source={D(source)} />;

  jsx(ImmediateMapper, { source: D(source) });

  // @ts-expect-error Immediate mapper inputs must be wrapped with D().
  <ImmediateMapper source={source} />;

  // @ts-expect-error Immediate mapper inputs must be wrapped with D() in slotted descriptors.
  S([ImmediateMapper, { source }]);

  // @ts-expect-error Immediate mapper inputs must be wrapped with D() in direct JSX calls.
  jsx(ImmediateMapper, { source });
};

void _typecheckImmediateJSX;
