import type { BaseBlockItemInputs, IBlockMeta, IRangeState } from '@flowdown/types';

import { D, MutableState, ReactiveState, render, S, type StateClosureInputProps } from 'reactive';
import { describe, expect, test, vi } from 'vitest';

import { BaseBlockItem } from '../index';

class TextBlock extends BaseBlockItem<string> {
  protected slice(value: string, start: number, end: number): string {
    return value.slice(start, end);
  }

  protected lengthOf(value: string): number {
    return value.length;
  }
}

const renderTextBlock = (inputs: StateClosureInputProps<BaseBlockItemInputs<string>>) => {
  return render(S([TextBlock, inputs]));
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

describe('BaseBlockItem', () => {
  test('keeps input subscriptions lazy until the corresponding values are read', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const range = MutableState.of<IRangeState | null>({ start: 1 });
    const block = renderTextBlock({ source, meta, range });

    expect([source, meta, range].map(getObserverCount)).toEqual([0, 0, 0]);

    expect(block.baseLength.value).toBe(5);
    expect(getObserverCount(source)).toBe(1);
    expect(getObserverCount(meta)).toBe(0);
    expect(getObserverCount(range)).toBe(0);

    expect(block.value.value).toBe('alue');
    expect(getObserverCount(range)).toBe(1);
    expect(getObserverCount(meta)).toBe(0);

    block.destroy();

    expect([source, meta, range].map(getObserverCount)).toEqual([0, 0, 0]);
  });

  test('clears internally constructed states without destroying its inputs', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const range = MutableState.of<IRangeState | null>({ start: 1 });
    const block = renderTextBlock({ source, meta, range });

    expect(block.value.value).toBe('alue');
    expect(block.length.value).toBe(4);
    const baseLength = block.baseLength;
    expect(getObserverCount(source)).toBeGreaterThan(0);
    expect(getObserverCount(range)).toBeGreaterThan(0);

    block.destroy();

    expect(block.value.closed).toBe(true);
    expect(block.length.closed).toBe(true);
    expect(baseLength.closed).toBe(true);
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
    const block = renderTextBlock({ source, meta, mapper: D(() => mapped) });

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

    expect(fork).toBeInstanceOf(TextBlock);
    expect(fork.value.value).toBe('lue');

    fork.destroy();

    expect(source.closed).toBe(false);
    expect(meta.closed).toBe(false);
    expect(range.closed).toBe(false);
    expect(block.value.value).toBe('value');

    block.destroy();
  });

  test('retains shared readable inputs until both a block and its fork are destroyed', () => {
    const source = MutableState.of('value');
    const meta = createMeta();
    const block = renderTextBlock({ source, meta });
    const fork = block.fork();

    expect(fork.value.value).toBe('value');

    block.destroy();
    source.next('updated');

    expect(fork.value.value).toBe('updated');
    expect(source.closed).toBe(false);

    fork.destroy();

    expect(getObserverCount(source)).toBe(0);
    expect(source.closed).toBe(false);
  });
});
