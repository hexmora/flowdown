import { beforeEach, describe, expect, test } from 'vitest';

import { DoubleStepSmoothScheduler, StepSmoothScheduler } from '../utils/smooth';
import {
  collectText,
  createBlock,
  firstBlock,
  latest,
  paragraph,
  PrimarySmoothTicker,
  resetSmoothTests,
  SecondarySmoothTicker,
  setupSmooth,
  visibleText,
} from './utils';

beforeEach(resetSmoothTests);

describe('Smooth configuration', () => {
  test('flushes disabled growth and enables without rewinding visible content', () => {
    const block = createBlock('a', paragraph('abc'));

    const harness = setupSmooth([block.block], false);

    const fork = firstBlock(harness.state.value.value);

    expect(collectText(fork.value.value)).toBe('abc');

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    expect(StepSmoothScheduler.instances).toHaveLength(0);

    block.source.next(paragraph('abcde'));

    expect(collectText(fork.value.value)).toBe('abcde');

    harness.enabled.next(true);

    expect(collectText(fork.value.value)).toBe('abcde');

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    block.source.next(paragraph('abcdefg'));

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(ticker.running).toBe(true);

    expect(collectText(fork.value.value)).toBe('abcde');

    ticker.tick(16);

    expect(collectText(fork.value.value)).toBe('abcdef');

    harness.enabled.next(false);

    expect(collectText(fork.value.value)).toBe('abcdefg');

    expect(fork.range.value).toEqual({ start: 0, end: 7 });

    expect(ticker.running).toBe(false);

    harness.state.destroy();
  });

  test('flushes pending blocks and metadata together when disabled', () => {
    const harness = setupSmooth();

    expect(harness.state.value.value).toEqual([]);

    harness.source.next([
      createBlock('a', paragraph('abc'), 0, 2).block,
      createBlock('b', paragraph('def'), 1, 2).block,
    ]);

    const ticker = latest(PrimarySmoothTicker.instances);

    ticker.tick(16);

    expect(visibleText(harness.state.value.value)).toEqual(['a']);

    harness.enabled.next(false);

    const output = harness.state.value.value;

    expect(visibleText(output)).toEqual(['abc', 'def']);

    expect(output.map((block) => block.range.value)).toEqual([null, { start: 0, end: 3 }]);

    expect(output.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);

    expect(ticker.running).toBe(false);

    harness.state.destroy();
  });

  test('replaces ticker and scheduler constructors while retaining visible forks', () => {
    const harness = setupSmooth();

    expect(harness.state.value.value).toEqual([]);

    harness.source.next([createBlock('a', paragraph('abcd')).block]);

    const primary = latest(PrimarySmoothTicker.instances);

    primary.tick(16);

    const fork = firstBlock(harness.state.value.value);

    harness.ticker.next(SecondarySmoothTicker);

    const secondary = latest(SecondarySmoothTicker.instances);

    expect(primary.destroyCalls).toBe(1);

    expect(primary.running).toBe(false);

    expect(secondary.running).toBe(true);

    expect(firstBlock(harness.state.value.value)).toBe(fork);

    expect(collectText(fork.value.value)).toBe('a');

    secondary.tick(16);

    expect(collectText(fork.value.value)).toBe('ab');

    harness.scheduler.next(DoubleStepSmoothScheduler);

    expect(DoubleStepSmoothScheduler.instances).toHaveLength(1);

    secondary.tick(32);

    expect(firstBlock(harness.state.value.value)).toBe(fork);

    expect(collectText(fork.value.value)).toBe('abcd');

    harness.state.destroy();
  });

  test('defers configuration changes while disabled and uses the latest choices on enable', () => {
    const harness = setupSmooth([], false);

    expect(harness.state.value.value).toEqual([]);

    harness.ticker.next(SecondarySmoothTicker);

    harness.scheduler.next(DoubleStepSmoothScheduler);

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    expect(SecondarySmoothTicker.instances).toHaveLength(0);

    expect(StepSmoothScheduler.instances).toHaveLength(0);

    harness.enabled.next(true);

    harness.source.next([createBlock('a', paragraph('abcd')).block]);

    latest(SecondarySmoothTicker.instances).tick(16);

    expect(visibleText(harness.state.value.value)).toEqual(['ab']);

    harness.state.destroy();
  });

  test('uses new configuration after disabling an already initialized runtime', () => {
    const block = createBlock('a', paragraph('a'));

    const harness = setupSmooth([block.block]);

    const fork = firstBlock(harness.state.value.value);

    block.source.next(paragraph('ab'));

    const primary = latest(PrimarySmoothTicker.instances);

    harness.enabled.next(false);

    harness.ticker.next(SecondarySmoothTicker);

    harness.scheduler.next(DoubleStepSmoothScheduler);

    block.source.next(paragraph('abc'));

    expect(primary.running).toBe(false);

    expect(collectText(fork.value.value)).toBe('abc');

    expect(SecondarySmoothTicker.instances).toHaveLength(0);

    harness.enabled.next(true);

    block.source.next(paragraph('abcdef'));

    latest(SecondarySmoothTicker.instances).tick(16);

    expect(firstBlock(harness.state.value.value)).toBe(fork);

    expect(collectText(fork.value.value)).toBe('abcde');

    expect(primary.destroyCalls).toBe(1);

    harness.state.destroy();
  });
});
