import { D, MutableState, ReactiveState, render, S } from 'reactive';
import { describe, expect, test, vi } from 'vitest';

import type { IRangeState } from '../../range';

import { BaseBlockStateClosure, type BaseBlockStateClosureInputs, type IBlockMeta } from '..';

class TextBlockStateClosure extends BaseBlockStateClosure<string> {
  protected slice(value: string, start: number, end: number): string {
    return value.slice(start, end);
  }

  protected lengthOf(value: string): number {
    return value.length;
  }
}

const renderTextBlock = (inputs: BaseBlockStateClosureInputs<string>) => {
  return render(S([TextBlockStateClosure, D(inputs)]));
};

const createMeta = () =>
  MutableState.of<IBlockMeta>({
    key: 'block',
    sourceText: 'value',
    charStart: 0,
    charEnd: 5,
    currentIndex: 0,
    blockCount: 1,
  });

const getObserverCount = (state: object) => {
  return (state as { subject: { observers: unknown[] } }).subject.observers.length;
};

describe('BaseBlockStateClosure', () => {
  test('clears internally constructed states without destroying its inputs', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const range = MutableState.of<IRangeState | null>({ start: 1 });
    const block = renderTextBlock({ source, meta, range });

    expect(block.value.value).toBe('alue');
    expect(block.length.value).toBe(4);
    expect(getObserverCount(source)).toBeGreaterThan(0);
    expect(getObserverCount(range)).toBeGreaterThan(0);

    block.destroy();

    expect(block.value.closed).toBe(true);
    expect(block.length.closed).toBe(true);
    expect(block.baseLength.closed).toBe(true);
    expect(source.closed).toBe(false);
    expect(meta.closed).toBe(false);
    expect(range.closed).toBe(false);
    expect(getObserverCount(source)).toBe(0);
    expect(getObserverCount(range)).toBe(0);
  });

  test('binds its internally constructed fallback range to its lifecycle', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const block = renderTextBlock({ source, meta });
    const rangeDestroy = vi.spyOn(block.range as ReactiveState<IRangeState | null>, 'destroy');

    block.destroy();

    expect(rangeDestroy).toHaveBeenCalledOnce();
    expect(source.closed).toBe(false);
    expect(meta.closed).toBe(false);
  });

  test('does not destroy a state returned by an external mapper', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const mapped = MutableState.of('mapped');
    const block = renderTextBlock({ source, meta, mapper: () => mapped });

    expect(block.value.value).toBe('mapped');
    expect(getObserverCount(mapped)).toBe(1);

    block.destroy();

    expect(mapped.closed).toBe(false);
    expect(getObserverCount(mapped)).toBe(0);
  });

  test('renders a concrete fork without taking ownership of shared inputs', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const range = MutableState.of<IRangeState | null>({ start: 2 });
    const block = renderTextBlock({ source, meta });

    const fork = block.fork({ range });

    expect(fork).toBeInstanceOf(TextBlockStateClosure);
    expect(fork.value.value).toBe('lue');

    fork.destroy();

    expect(source.closed).toBe(false);
    expect(meta.closed).toBe(false);
    expect(range.closed).toBe(false);
    expect(block.value.value).toBe('value');

    block.destroy();
  });
});
