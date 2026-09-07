import { BatchScheduler } from 'reactive';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { StepSmoothScheduler } from '../utils/smooth';
import {
  collectText,
  createBlock,
  firstBlock,
  latest,
  observerCount,
  paragraph,
  PrimarySmoothTicker,
  resetSmoothTests,
  setupSmooth,
  visibleText,
} from './utils';

beforeEach(resetSmoothTests);

describe('Smooth ownership', () => {
  test.each(['ticker start', 'scheduler constructor'] as const)(
    'destroys owned resources after %s fails on the first content growth',
    (stage) => {
      const failure = new Error('Smooth initialization failed.');

      class FailingTicker extends PrimarySmoothTicker {
        override start(): number {
          super.start();

          throw failure;
        }
      }

      class FailingScheduler extends StepSmoothScheduler {
        constructor() {
          super();

          throw failure;
        }
      }

      const block = createBlock('a', paragraph('ready'));

      const harness = setupSmooth([block.block]);

      if (stage === 'ticker start') {
        harness.ticker.next(FailingTicker);
      } else {
        harness.scheduler.next(FailingScheduler);
      }

      const error = vi.fn();

      harness.state.value.subscribe({ error });

      if (stage === 'scheduler constructor') {
        expect(() => block.source.next(paragraph('ready to stream'))).toThrow(failure);
      } else {
        block.source.next(paragraph('ready to stream'));

        expect(error).toHaveBeenCalledExactlyOnceWith(failure);

        expect(PrimarySmoothTicker.instances.every((ticker) => !ticker.running)).toBe(true);
      }

      harness.state.destroy();

      expect(observerCount(block.block.baseLength)).toBe(0);

      expect(PrimarySmoothTicker.instances.every((ticker) => !ticker.running)).toBe(true);

      expect(block.source.closed).toBe(false);
    },
  );

  test('drains pending content before completing after all upstream states finish', () => {
    const block = createBlock('a', paragraph('abc'));

    const harness = setupSmooth();

    const output = harness.state.value;

    const complete = vi.fn();

    output.subscribe({ complete });

    harness.source.next([block.block]);

    const fork = firstBlock(output.value);

    const ticker = latest(PrimarySmoothTicker.instances);

    block.source.complete();

    harness.source.complete();

    harness.enabled.complete();

    harness.ticker.complete();

    harness.scheduler.complete();

    expect(block.block.baseLength.closed).toBe(true);

    expect(collectText(fork.value.value)).toBe('');

    expect(output.closed).toBe(false);

    expect(ticker.running).toBe(true);

    expect(complete).not.toHaveBeenCalled();

    ticker.tick(16);

    ticker.tick(32);

    expect(collectText(fork.value.value)).toBe('ab');

    expect(output.closed).toBe(false);

    ticker.tick(48);

    expect(collectText(fork.value.value)).toBe('abc');

    expect(output.closed).toBe(true);

    expect(complete).toHaveBeenCalledOnce();

    expect(ticker.running).toBe(false);

    harness.state.destroy();
  });

  test.each([
    { change: 'content', intermediate: ['ab'], final: ['abc'] },
    { change: 'blocks', intermediate: ['a', 'b'], final: ['a', 'bc'] },
  ])('drains final $change changes committed with upstream completion', (scenario) => {
    const first = createBlock('first', paragraph('a'));

    const second = createBlock('second', paragraph('bc'));

    const harness = setupSmooth([first.block]);

    const output = harness.state.value;

    const complete = vi.fn();

    output.subscribe({ complete });

    BatchScheduler.batch(() => {
      if (scenario.change === 'content') {
        first.source.next(paragraph('abc'));
      } else {
        harness.source.next([first.block, second.block]);
      }

      first.source.complete();

      second.source.complete();

      harness.source.complete();

      harness.enabled.complete();

      harness.ticker.complete();

      harness.scheduler.complete();
    });

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(visibleText(output.value)).toEqual(['a']);

    expect(output.closed).toBe(false);

    expect(complete).not.toHaveBeenCalled();

    expect(ticker.running).toBe(true);

    ticker.tick(16);

    expect(visibleText(output.value)).toEqual(scenario.intermediate);

    expect(output.closed).toBe(false);

    ticker.tick(32);

    expect(visibleText(output.value)).toEqual(scenario.final);

    expect(output.closed).toBe(true);

    expect(complete).toHaveBeenCalledOnce();

    expect(ticker.running).toBe(false);

    expect(ticker.destroyCalls).toBe(1);

    harness.state.destroy();

    expect(ticker.destroyCalls).toBe(1);
  });

  test.each([false, true])(
    'completes already visible content without another emission when enabled is %s',
    (enabled) => {
      const block = createBlock('a', paragraph('ready'));

      const harness = setupSmooth([block.block], enabled);

      const output = harness.state.value;

      const next = vi.fn();

      const complete = vi.fn();

      output.subscribe({ next, complete });

      BatchScheduler.batch(() => {
        block.source.complete();

        harness.source.complete();

        harness.enabled.complete();

        harness.ticker.complete();

        harness.scheduler.complete();
      });

      expect(visibleText(output.value)).toEqual(['ready']);

      expect(output.closed).toBe(true);

      expect(next).toHaveBeenCalledOnce();

      expect(complete).toHaveBeenCalledOnce();

      expect(PrimarySmoothTicker.instances).toHaveLength(0);

      expect(PrimarySmoothTicker.instances.every((ticker) => !ticker.running)).toBe(true);

      harness.state.destroy();

      expect(PrimarySmoothTicker.instances.every((ticker) => ticker.destroyCalls === 1)).toBe(true);
    },
  );

  test('releases removed forks and restarts a cleared stream from zero', () => {
    const block = createBlock('old', paragraph('old'));

    const harness = setupSmooth([block.block]);

    const fork = firstBlock(harness.state.value.value);

    const destroyFork = vi.spyOn(fork, 'destroy');

    const meta = fork.meta;

    const range = fork.range;

    const destroySource = vi.spyOn(block.block, 'destroy');

    expect(observerCount(block.block.baseLength)).toBeGreaterThan(0);

    harness.source.next([]);

    expect(harness.state.value.value).toEqual([]);

    expect(destroyFork).toHaveBeenCalledOnce();

    expect(meta.closed).toBe(true);

    expect(range.closed).toBe(true);

    expect(destroySource).not.toHaveBeenCalled();

    expect(observerCount(block.block.baseLength)).toBe(0);

    harness.source.next([createBlock('new', paragraph('new')).block]);

    expect(visibleText(harness.state.value.value)).toEqual(['']);

    const ticker = latest(PrimarySmoothTicker.instances);

    for (const time of [16, 32, 48]) {
      ticker.tick(time);
    }

    expect(visibleText(harness.state.value.value)).toEqual(['new']);

    harness.state.destroy();
  });

  test('destroys owned resources once and releases every borrowed subscription', () => {
    const block = createBlock('a', paragraph('value'));

    const harness = setupSmooth([block.block]);

    const subscription = harness.state.value.subscribe(() => undefined);

    const fork = firstBlock(harness.state.value.value);

    const destroyFork = vi.spyOn(fork, 'destroy');

    const meta = fork.meta;

    const range = fork.range;

    const destroySource = vi.spyOn(block.block, 'destroy');

    block.source.next(paragraph('value grows'));

    const ticker = latest(PrimarySmoothTicker.instances);

    const borrowed = [
      harness.source,
      harness.enabled,
      harness.ticker,
      harness.scheduler,
      block.block.baseLength,
    ];

    expect(borrowed.every((state) => observerCount(state) > 0)).toBe(true);

    harness.state.destroy();

    harness.state.destroy();

    expect(subscription.closed).toBe(true);

    expect(ticker.destroyCalls).toBe(1);

    expect(ticker.running).toBe(false);

    expect(destroyFork).toHaveBeenCalledOnce();

    expect(meta.closed).toBe(true);

    expect(range.closed).toBe(true);

    expect(destroySource).not.toHaveBeenCalled();

    expect(borrowed.map(observerCount)).toEqual([0, 0, 0, 0, 0]);

    expect([...borrowed, block.source, block.meta].every((state) => !state.closed)).toBe(true);
  });

  test('can be destroyed before initialization without creating runtime resources', () => {
    const block = createBlock('a', paragraph('value'));

    const harness = setupSmooth([block.block]);

    const destroySource = vi.spyOn(block.block, 'destroy');

    expect(
      [harness.source, harness.enabled, harness.ticker, harness.scheduler].map(observerCount),
    ).toEqual([0, 0, 0, 0]);

    harness.state.destroy();

    harness.state.destroy();

    expect(PrimarySmoothTicker.instances).toHaveLength(0);

    expect(StepSmoothScheduler.instances).toHaveLength(0);

    expect(destroySource).not.toHaveBeenCalled();

    expect(() => harness.state.value).toThrow(/destroyed state closure/);
  });

  test('forwards source errors and still releases owned resources on destroy', () => {
    const block = createBlock('a', paragraph('value'));

    const harness = setupSmooth([block.block]);

    const error = vi.fn();

    const subscription = harness.state.value.subscribe({ error });

    block.source.next(paragraph('value grows'));

    const ticker = latest(PrimarySmoothTicker.instances);

    const failure = new Error('Source failed.');

    harness.source.error(failure);

    expect(error).toHaveBeenCalledExactlyOnceWith(failure);

    expect(subscription.closed).toBe(true);

    harness.state.destroy();

    expect(ticker.running).toBe(false);

    expect(ticker.destroyCalls).toBe(1);

    expect(block.source.closed).toBe(false);

    expect(observerCount(block.block.baseLength)).toBe(0);
  });
});
