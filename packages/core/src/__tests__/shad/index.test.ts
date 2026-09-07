import type { IBlockState, IRangeState } from '@flowdown/types';

import { Shad } from '@flowdown/core-presets/mapper';
import { BatchScheduler, MutableState, render, S } from 'reactive';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../typings';

import { collectText, createBlock, firstBlock, observerCount, paragraph } from '../smooth/utils';
import { readParts } from './utils';

const cleanups = new Set<() => void>();

const setup = (blocks: IBlockState<HastRoot>[], initialEnabled = true, initialLength = 2) => {
  const source = MutableState.of(blocks);

  const enabled = MutableState.of(initialEnabled);

  const length = MutableState.of(initialLength);

  const state = render(S([Shad, { source, enabled, length }]));

  cleanups.add(() => state.destroy());

  return { state, source, enabled, length };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());

  cleanups.clear();

  vi.useRealTimers();
});

describe('Shad', () => {
  test('keeps the initial tail idle and shades only new text until growth stops', () => {
    const block = createBlock('a', paragraph('abcd'));

    const harness = setup([block.block]);

    const output = harness.state.value;

    const fork = firstBlock(output.value);

    expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

    expect(fork.length.value).toBe(4);

    expect(vi.getTimerCount()).toBe(0);

    block.source.next(paragraph('abcde'));

    expect(firstBlock(output.value)).toBe(fork);

    expect(readParts(fork.value.value)).toEqual({ leading: 'd', active: 'e' });

    expect(fork.length.value).toBe(5);

    vi.advanceTimersByTime(100);

    block.source.next(paragraph('abcdef'));

    expect(readParts(fork.value.value)).toEqual({ leading: '', active: 'ef' });

    vi.advanceTimersByTime(199);

    expect(readParts(fork.value.value)?.active).toBe('ef');

    vi.advanceTimersByTime(1);

    expect(readParts(fork.value.value)).toEqual({ leading: 'ef', active: '' });

    block.source.next(paragraph('abcdefg'));

    expect(readParts(fork.value.value)).toEqual({ leading: 'f', active: 'g' });

    expect(fork.length.value).toBe(7);
  });

  test('does not restart the timeout for equal-length replacements or reactivate a shortened tail', () => {
    const block = createBlock('a', paragraph('abc'));

    const harness = setup([block.block]);

    const fork = firstBlock(harness.state.value.value);

    expect(readParts(fork.value.value)).toEqual({ leading: 'bc', active: '' });

    block.source.next(paragraph('abc*d'));

    expect(readParts(fork.value.value)).toEqual({ leading: '', active: '*d' });

    block.source.next(paragraph('abcd'));

    expect(readParts(fork.value.value)).toEqual({ leading: 'c', active: 'd' });

    vi.advanceTimersByTime(100);

    block.source.next(paragraph('wxyz'));

    expect(readParts(fork.value.value)).toEqual({ leading: 'y', active: 'z' });

    vi.advanceTimersByTime(100);

    expect(readParts(fork.value.value)).toEqual({ leading: 'yz', active: '' });

    block.source.next(paragraph('same'));

    expect(readParts(fork.value.value)).toEqual({ leading: 'me', active: '' });

    expect(vi.getTimerCount()).toBe(0);
  });

  test('updates the visible total only when the last block or source list changes', () => {
    const first = createBlock('first', paragraph('ab'));

    const last = createBlock('last', paragraph('cd'));

    const harness = setup([first.block, last.block]);

    const output = harness.state.value;

    const firstFork = firstBlock(output.value);

    const lastFork = output.value[1]!;

    first.source.next(paragraph('abc'));

    expect(collectText(firstFork.value.value)).toBe('abc');

    expect(readParts(firstFork.value.value)).toBeUndefined();

    expect(readParts(lastFork.value.value)).toEqual({ leading: 'cd', active: '' });

    expect(vi.getTimerCount()).toBe(0);

    last.source.next(paragraph('cde'));

    expect(readParts(lastFork.value.value)).toEqual({ leading: '', active: 'de' });

    vi.advanceTimersByTime(200);

    first.source.next(paragraph('abcd'));

    expect(readParts(lastFork.value.value)).toEqual({ leading: 'de', active: '' });

    harness.source.next([first.block, last.block]);

    expect(readParts(lastFork.value.value)).toEqual({ leading: 'd', active: 'e' });
  });

  test.each(['enabled', 'length'] as const)(
    'retains the active window when %s disables shading during a shorter continuation',
    (config) => {
      const block = createBlock('a', paragraph('abc'));

      const harness = setup([block.block]);

      const fork = firstBlock(harness.state.value.value);

      block.source.next(paragraph('abcdef'));

      if (config === 'enabled') {
        harness.enabled.next(false);
      } else {
        harness.length.next(0);
      }

      block.source.next(paragraph('abcd'));

      expect(readParts(fork.value.value)).toBeUndefined();

      expect(vi.getTimerCount()).toBe(1);

      vi.advanceTimersByTime(100);

      if (config === 'enabled') {
        harness.enabled.next(true);
      } else {
        harness.length.next(2);
      }

      expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

      block.source.next(paragraph('abcde'));

      expect(readParts(fork.value.value)).toEqual({ leading: 'd', active: 'e' });

      vi.advanceTimersByTime(99);

      expect(readParts(fork.value.value)?.active).toBe('e');

      vi.advanceTimersByTime(1);

      expect(readParts(fork.value.value)).toEqual({ leading: 'de', active: '' });

      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test.each(['source', 'length'] as const)(
    'retains the settled prefix when %s clears within the active window',
    (reset) => {
      const block = createBlock('a', paragraph('abc'));

      const harness = setup([block.block]);

      expect(readParts(firstBlock(harness.state.value.value).value.value)).toEqual({
        leading: 'bc',
        active: '',
      });

      block.source.next(paragraph('abcde'));

      if (reset === 'source') {
        harness.source.next([]);
      } else {
        block.source.next(paragraph(''));
      }

      expect(vi.getTimerCount()).toBe(1);

      block.source.next(paragraph('xy'));

      if (reset === 'source') {
        harness.source.next([block.block]);
      }

      const fork = firstBlock(harness.state.value.value);

      expect(readParts(fork.value.value)).toEqual({ leading: 'xy', active: '' });

      block.source.next(paragraph('xyzw'));

      expect(readParts(fork.value.value)).toEqual({ leading: 'z', active: 'w' });

      vi.advanceTimersByTime(200);

      expect(readParts(fork.value.value)).toEqual({ leading: 'zw', active: '' });

      block.source.next(paragraph('xyzwt'));

      expect(readParts(fork.value.value)).toEqual({ leading: 'w', active: 't' });
    },
  );

  test('resizes the tail and commits growth while disabled without replacing the block', () => {
    const block = createBlock('a', paragraph('abcd'));

    const harness = setup([block.block]);

    const fork = firstBlock(harness.state.value.value);

    expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

    block.source.next(paragraph('abcde'));

    harness.length.next(4);

    expect(readParts(fork.value.value)).toEqual({ leading: 'bcd', active: 'e' });

    harness.enabled.next(false);

    expect(readParts(fork.value.value)).toBeUndefined();

    expect(vi.getTimerCount()).toBe(1);

    block.source.next(paragraph('abcdef'));

    harness.enabled.next(true);

    expect(readParts(fork.value.value)).toEqual({ leading: 'cdef', active: '' });

    block.source.next(paragraph('abcdefg'));

    expect(readParts(fork.value.value)).toEqual({ leading: 'def', active: 'g' });

    harness.length.next(0);

    expect(readParts(fork.value.value)).toBeUndefined();

    harness.length.next(2);

    expect(readParts(fork.value.value)).toEqual({ leading: 'fg', active: '' });

    expect(firstBlock(harness.state.value.value)).toBe(fork);
  });

  test('follows the last source instance through replacement, removal, and restart', () => {
    const first = createBlock('same', paragraph('old'));

    const replacement = createBlock('same', paragraph('new'));

    const last = createBlock('last', paragraph('tail'));

    const harness = setup([first.block, last.block]);

    const output = harness.state.value;

    const oldFork = firstBlock(output.value);

    const lastFork = output.value[1]!;

    const destroyOld = vi.spyOn(oldFork, 'destroy');

    const destroyLast = vi.spyOn(lastFork, 'destroy');

    expect(readParts(oldFork.value.value)).toBeUndefined();

    expect(readParts(lastFork.value.value)).toEqual({ leading: 'il', active: '' });

    harness.source.next([replacement.block, last.block]);

    const newFork = firstBlock(output.value);

    expect(newFork).not.toBe(oldFork);

    expect(output.value[1]).toBe(lastFork);

    expect(collectText(newFork.value.value)).toBe('new');

    expect(destroyOld).toHaveBeenCalledOnce();

    harness.source.next([replacement.block]);

    expect(firstBlock(output.value)).toBe(newFork);

    expect(readParts(newFork.value.value)).toEqual({ leading: 'ew', active: '' });

    expect(destroyLast).toHaveBeenCalledOnce();

    harness.source.next([]);

    expect(output.value).toEqual([]);

    harness.source.next([last.block]);

    expect(readParts(firstBlock(output.value).value.value)).toEqual({ leading: '', active: 'il' });

    expect(first.source.closed).toBe(false);

    expect(last.source.closed).toBe(false);
  });

  test('preserves a preceding mapper output together with its reactive range and metadata', () => {
    const block = createBlock('a', paragraph('abcdef'));

    const range = MutableState.of<IRangeState | null>({ start: 0, end: 3 });

    const mapped = MutableState.of(paragraph('ABC'));

    const previous = block.block.fork({ range, mapper: () => mapped });

    cleanups.add(() => previous.destroy());

    const harness = setup([previous]);

    const fork = firstBlock(harness.state.value.value);

    expect(collectText(fork.value.value)).toBe('ABC');

    expect(fork.range.value).toEqual({ start: 0, end: 3 });

    expect(fork.meta.value).toEqual(previous.meta.value);

    BatchScheduler.batch(() => {
      range.next({ start: 0, end: 4 });

      mapped.next(paragraph('ABCD'));
    });

    expect(collectText(fork.value.value)).toBe('ABCD');

    expect(fork.range.value).toEqual({ start: 0, end: 4 });

    expect(readParts(fork.value.value)).toEqual({ leading: 'C', active: 'D' });

    expect(fork.length.value).toBe(previous.length.value);
  });

  test('retains surviving fork identities when blocks move or preceding blocks are removed', () => {
    const first = createBlock('first', paragraph('abc'));

    const second = createBlock('second', paragraph('def'));

    const harness = setup([first.block, second.block]);

    const output = harness.state.value;

    const firstFork = firstBlock(output.value);

    const secondFork = output.value[1]!;

    const destroyFirst = vi.spyOn(firstFork, 'destroy');

    const destroySecond = vi.spyOn(secondFork, 'destroy');

    const destroyFirstSource = vi.spyOn(first.block, 'destroy');

    const destroySecondSource = vi.spyOn(second.block, 'destroy');

    expect(readParts(firstFork.value.value)).toBeUndefined();

    expect(readParts(secondFork.value.value)).toEqual({ leading: 'ef', active: '' });

    harness.source.next([second.block, first.block]);

    expect(firstBlock(output.value)).toBe(secondFork);

    expect(output.value[1]).toBe(firstFork);

    expect(readParts(secondFork.value.value)).toBeUndefined();

    expect(readParts(firstFork.value.value)).toEqual({ leading: 'bc', active: '' });

    expect(destroyFirst).not.toHaveBeenCalled();

    expect(destroySecond).not.toHaveBeenCalled();

    harness.source.next([first.block]);

    expect(firstBlock(output.value)).toBe(firstFork);

    expect(destroyFirst).not.toHaveBeenCalled();

    expect(destroySecond).toHaveBeenCalledOnce();

    expect(observerCount(second.block.length)).toBe(0);

    expect(destroyFirstSource).not.toHaveBeenCalled();

    expect(destroySecondSource).not.toHaveBeenCalled();

    first.source.next(paragraph('abcd'));

    expect(collectText(firstFork.value.value)).toBe('abcd');

    harness.state.destroy();

    expect(destroyFirst).toHaveBeenCalledOnce();

    expect(destroySecond).toHaveBeenCalledOnce();

    expect(destroyFirstSource).not.toHaveBeenCalled();

    expect(destroySecondSource).not.toHaveBeenCalled();
  });

  test('releases forks, borrowed subscriptions, and the timer exactly once on destroy', () => {
    const block = createBlock('a', paragraph('abc'));

    const harness = setup([block.block]);

    const subscription = harness.state.value.subscribe(() => undefined);

    const fork = firstBlock(harness.state.value.value);

    const destroyFork = vi.spyOn(fork, 'destroy');

    const destroySource = vi.spyOn(block.block, 'destroy');

    expect(readParts(fork.value.value)).toEqual({ leading: 'bc', active: '' });

    block.source.next(paragraph('abcd'));

    expect(readParts(fork.value.value)?.active).toBe('d');

    const borrowed = [harness.source, harness.enabled, harness.length, block.block.length];

    expect(borrowed.every((state) => observerCount(state) > 0)).toBe(true);

    expect(vi.getTimerCount()).toBe(1);

    harness.state.destroy();

    harness.state.destroy();

    expect(subscription.closed).toBe(true);

    expect(destroyFork).toHaveBeenCalledOnce();

    expect(destroySource).not.toHaveBeenCalled();

    expect(borrowed.map(observerCount)).toEqual([0, 0, 0, 0]);

    expect([...borrowed, block.source, block.meta].every((state) => !state.closed)).toBe(true);

    expect(vi.getTimerCount()).toBe(0);
  });

  test('waits for the final active suffix to settle after upstream completion', () => {
    const block = createBlock('a', paragraph('abc'));

    const harness = setup([block.block]);

    const output = harness.state.value;

    const fork = firstBlock(output.value);

    const complete = vi.fn();

    fork.value.subscribe({ complete });

    BatchScheduler.batch(() => {
      block.source.next(paragraph('abcd'));

      block.source.complete();

      block.meta.complete();

      harness.source.complete();

      harness.enabled.complete();

      harness.length.complete();
    });

    expect(readParts(fork.value.value)).toEqual({ leading: 'c', active: 'd' });

    expect(fork.value.closed).toBe(false);

    expect(complete).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(readParts(fork.value.value)).toEqual({ leading: 'cd', active: '' });

    expect(fork.value.closed).toBe(true);

    expect(complete).toHaveBeenCalledOnce();

    expect(vi.getTimerCount()).toBe(0);
  });
});
