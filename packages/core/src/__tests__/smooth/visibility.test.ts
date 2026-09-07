import { Smooth } from '@flowdown/core-presets/mapper';
import { BatchScheduler, ReactiveState, render, S } from 'reactive';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { HastRoot } from '../../typings';

import { DoubleStepSmoothScheduler, StepSmoothScheduler } from '../utils/smooth';
import {
  collectText,
  createBlock,
  element,
  firstBlock,
  latest,
  paragraph,
  PrimarySmoothTicker,
  resetSmoothTests,
  root,
  SecondarySmoothTicker,
  setupSmooth,
  text,
  visibleText,
} from './utils';

beforeEach(resetSmoothTests);

describe('Smooth visibility', () => {
  test('preserves visible progress when an atomic edit redistributes block lengths', () => {
    const a = createBlock('a', paragraph('abcde'), 0, 2);

    const b = createBlock('b', paragraph('f'), 1, 2);

    const harness = setupSmooth([a.block, b.block]);

    const initial = harness.state.value.value;

    expect(visibleText(initial)).toEqual(['abcde', 'f']);

    BatchScheduler.batch(() => {
      a.source.next(paragraph('a'));

      b.source.next(paragraph('bcdef'));
    });

    expect(visibleText(harness.state.value.value)).toEqual(['a', 'bcdef']);

    expect(harness.state.value.value).toBe(initial);

    harness.state.destroy();
  });

  test('initializes from the latest inputs without constructing stale runtime choices', () => {
    const stale = createBlock('stale', paragraph('old'));

    const current = createBlock('current', paragraph('latest'));

    const harness = setupSmooth([stale.block]);

    const forkStale = vi.spyOn(stale.block, 'fork');

    harness.source.next([current.block]);

    harness.ticker.next(SecondarySmoothTicker);

    harness.scheduler.next(DoubleStepSmoothScheduler);

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    expect(SecondarySmoothTicker.instances).toHaveLength(0);

    expect(StepSmoothScheduler.instances).toHaveLength(0);

    expect(visibleText(harness.state.value.value)).toEqual(['latest']);

    expect(forkStale).not.toHaveBeenCalled();

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    expect(SecondarySmoothTicker.instances).toHaveLength(0);

    current.source.next(paragraph('latest content'));

    expect(SecondarySmoothTicker.instances).toHaveLength(1);

    expect(DoubleStepSmoothScheduler.instances).toHaveLength(1);

    harness.state.destroy();
  });

  test('shows initial content through stable forks without starting timing work', () => {
    const a = createBlock('a', paragraph('abc'), 0, 2);

    const b = createBlock('b', paragraph('def'), 1, 2);

    const harness = setupSmooth([a.block, b.block]);

    const output = harness.state.value.value;

    expect(visibleText(output)).toEqual(['abc', 'def']);

    expect(output[0]).not.toBe(a.block);

    expect(output[1]).not.toBe(b.block);

    expect(output.map((block) => block.range.value)).toEqual([null, { start: 0, end: 3 }]);

    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    expect(StepSmoothScheduler.instances).toHaveLength(0);

    expect(harness.state.value.value).toBe(output);

    harness.state.destroy();
  });

  test('crosses block boundaries only after advancing beyond the preceding tail', () => {
    const harness = setupSmooth();

    const sizes: number[] = [];

    harness.state.value.subscribe((blocks) => sizes.push(blocks.length));

    const a = createBlock('a', paragraph('abc'), 0, 2);

    const b = createBlock('b', paragraph('def'), 1, 2);

    harness.source.next([a.block, b.block]);

    const fork = firstBlock(harness.state.value.value);

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(fork.range.value).toEqual({ start: 0, end: 0 });

    expect(fork.meta.value.blockCount).toBe(1);

    expect(a.meta.value.blockCount).toBe(2);

    ticker.tick(16);

    ticker.tick(32);

    expect(collectText(fork.value.value)).toBe('ab');

    expect(sizes).toEqual([0, 1]);

    ticker.tick(48);

    expect(harness.state.value.value).toHaveLength(1);

    expect(fork.range.value).toEqual({ start: 0, end: 3 });

    ticker.tick(64);

    const output = harness.state.value.value;

    expect(output[0]).toBe(fork);

    expect(output.map((block) => block.range.value)).toEqual([null, { start: 0, end: 1 }]);

    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);

    expect(sizes).toEqual([0, 1, 2]);

    ticker.tick(80);

    ticker.tick(96);

    expect(harness.state.value.value).toBe(output);

    expect(visibleText(output)).toEqual(['abc', 'def']);

    harness.state.destroy();
  });

  test('publishes new forks with their initial range and metadata already ready', () => {
    const harness = setupSmooth();

    const snapshots: unknown[] = [];

    harness.state.value.subscribe((blocks) =>
      snapshots.push(
        blocks.map((block) => ({
          count: block.meta.value.blockCount,
          range: block.range.value,
          text: collectText(block.value.value),
        })),
      ),
    );

    harness.source.next([createBlock('a', paragraph('abc')).block]);

    expect(snapshots).toEqual([[], [{ count: 1, range: { start: 0, end: 0 }, text: '' }]]);

    harness.state.destroy();
  });

  test('slices graphemes and atomic elements while preserving their ancestors', () => {
    const harness = setupSmooth();

    expect(harness.state.value.value).toEqual([]);

    const strong = element('strong', [text('👩🏽‍💻é')]);

    const image = element('img');

    harness.source.next([
      createBlock('rich', root([element('p', [strong, image, text('z')])])).block,
    ]);

    const fork = firstBlock(harness.state.value.value);

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(collectText(fork.value.value)).toBe('');

    ticker.tick(16);

    expect(fork.value.value).toEqual(root([element('p', [element('strong', [text('👩🏽‍💻')])])]));

    ticker.tick(32);

    expect(collectText(fork.value.value)).toBe('👩🏽‍💻é');

    ticker.tick(48);

    expect(fork.value.value).toEqual(root([element('p', [strong, image])]));

    ticker.tick(64);

    expect(collectText(fork.value.value)).toBe('👩🏽‍💻éz');

    harness.state.destroy();
  });

  test('filters invisible HAST content from a fully exposed boundary block', () => {
    const value = root([
      element('p', [text('abc')]),
      element('script', [text('hidden')]),
      { type: 'comment', value: 'note' },
    ]);

    const harness = setupSmooth([createBlock('a', value).block]);

    const output = firstBlock(harness.state.value.value).value.value;

    expect(output).not.toBe(value);

    expect(output).toEqual(paragraph('abc'));

    expect(value.children).toHaveLength(3);

    harness.state.destroy();
  });

  test('smooths same-block growth and same-length edits without outer emissions', () => {
    const block = createBlock('a', paragraph('ab'));

    const harness = setupSmooth([block.block]);

    const outputs = vi.fn();

    harness.state.value.subscribe(outputs);

    const fork = firstBlock(harness.state.value.value);

    block.source.next(paragraph('abcd'));

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(collectText(fork.value.value)).toBe('ab');

    ticker.tick(16);

    expect(collectText(fork.value.value)).toBe('abc');

    block.source.next(paragraph('wxyz'));

    expect(collectText(fork.value.value)).toBe('wxy');

    ticker.tick(32);

    expect(collectText(fork.value.value)).toBe('wxyz');

    expect(firstBlock(harness.state.value.value)).toBe(fork);

    expect(outputs).toHaveBeenCalledOnce();

    harness.state.destroy();
  });

  test('continues tracking live blocks after the outer source completes', () => {
    const block = createBlock('a', paragraph('abc'));

    const source = ReactiveState.of([block.block]);

    const state = render(
      S([
        Smooth<HastRoot>,
        {
          source,
          enabled: ReactiveState.of(true),
          ticker: ReactiveState.of(PrimarySmoothTicker),
          scheduler: ReactiveState.of(StepSmoothScheduler),
        },
      ]),
    );

    const fork = firstBlock(state.value.value);

    expect(source.closed).toBe(true);

    block.source.next(paragraph('abcd'));

    expect(collectText(fork.value.value)).toBe('abc');

    latest(PrimarySmoothTicker.instances).tick(16);

    expect(collectText(fork.value.value)).toBe('abcd');

    state.destroy();
  });

  test('clamps shrinking content and resumes later growth from the visible cursor', () => {
    const harness = setupSmooth();

    expect(harness.state.value.value).toEqual([]);

    const block = createBlock('a', paragraph('abcdefgh'));

    harness.source.next([block.block]);

    const ticker = latest(PrimarySmoothTicker.instances);

    const fork = firstBlock(harness.state.value.value);

    ticker.tick(16);

    ticker.tick(32);

    block.source.next(paragraph('abcde'));

    expect(collectText(fork.value.value)).toBe('ab');

    for (const time of [48, 64, 80]) {
      ticker.tick(time);
    }

    expect(collectText(fork.value.value)).toBe('abcde');

    block.source.next(paragraph('a'));

    expect(collectText(fork.value.value)).toBe('a');

    block.source.next(paragraph('abcd'));

    expect(collectText(fork.value.value)).toBe('a');

    for (const time of [96, 112, 128]) {
      ticker.tick(time);
    }

    expect(collectText(fork.value.value)).toBe('abcd');

    harness.state.destroy();
  });

  test('keeps an explicit boundary on the last block after a multi-block shrink', () => {
    const a = createBlock('a', paragraph('abc'), 0, 2);

    const b = createBlock('b', paragraph('def'), 1, 2);

    const harness = setupSmooth([a.block, b.block]);

    const output = harness.state.value.value;

    b.source.next(paragraph('d'));

    expect(harness.state.value.value).toBe(output);

    expect(visibleText(output)).toEqual(['abc', 'd']);

    expect(output.map((block) => block.range.value)).toEqual([null, { start: 0, end: 1 }]);

    harness.state.destroy();
  });

  test('updates source metadata without mutating the source block count', () => {
    const block = createBlock('a', paragraph('abc'), 0, 5);

    const harness = setupSmooth([block.block]);

    const fork = firstBlock(harness.state.value.value);

    block.meta.next({
      ...block.meta.value,
      sourceText: 'revised',
      charStart: 5,
      charEnd: 12,
      blockCount: 7,
    });

    expect(fork.meta.value).toEqual({ ...block.meta.value, blockCount: 1 });

    expect(block.meta.value.blockCount).toBe(7);

    harness.state.destroy();
  });

  test('reorders surviving forks to match the current source array', () => {
    const a = createBlock('a', paragraph('abc'), 0, 2);

    const b = createBlock('b', paragraph('def'), 1, 2);

    const harness = setupSmooth([a.block, b.block]);

    const [forkA, forkB] = harness.state.value.value;

    a.meta.next({ ...a.meta.value, currentIndex: 1 });

    b.meta.next({ ...b.meta.value, currentIndex: 0 });

    harness.source.next([b.block, a.block]);

    const output = harness.state.value.value;

    expect(output).toEqual([forkB, forkA]);

    expect(visibleText(output)).toEqual(['def', 'abc']);

    expect(output.map((block) => block.range.value)).toEqual([null, { start: 0, end: 3 }]);

    expect(output.map((block) => block.meta.value.currentIndex)).toEqual([0, 1]);

    harness.state.destroy();
  });
});
