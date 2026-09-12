import {
  createBlock,
  firstBlock,
  latest,
  paragraph,
  PrimarySmoothTicker,
  resetSmoothTests,
  root,
  setupSmooth,
} from './utils';

beforeEach(resetSmoothTests);

describe('Smooth empty blocks', () => {
  test('omits empty and all-zero-length sources', () => {
    const harness = setupSmooth([createBlock('empty', root()).block]);

    expect(harness.state.value.value).toEqual([]);

    harness.source.next([]);

    expect(harness.state.value.value).toEqual([]);

    harness.state.destroy();
  });

  test('shows only a leading empty block at cursor zero', () => {
    const harness = setupSmooth();

    expect(harness.state.value.value).toEqual([]);

    const empty = createBlock('empty', root(), 0, 2);

    const content = createBlock('content', paragraph('abc'), 1, 2);

    const forkContent = jest.spyOn(content.block, 'fork');

    harness.source.next([empty.block, content.block]);

    const output = harness.state.value.value;

    expect(output.map((block) => block.meta.value.key)).toEqual(['empty']);

    expect(firstBlock(output).range.value).toEqual({ start: 0, end: 0 });

    expect(firstBlock(output).meta.value.blockCount).toBe(1);

    expect(forkContent).not.toHaveBeenCalled();

    latest(PrimarySmoothTicker.instances).tick(16);

    const advanced = harness.state.value.value;

    expect(advanced.map((block) => block.meta.value.key)).toEqual(['empty', 'content']);

    expect(advanced.map((block) => block.range.value)).toEqual([null, { start: 0, end: 1 }]);

    expect(advanced.map((block) => block.meta.value.blockCount)).toEqual([2, 2]);

    expect(forkContent).toHaveBeenCalledTimes(1);

    harness.state.destroy();
  });

  test('keeps empty blocks hidden at exact boundaries and removes a trailing empty fork', () => {
    const harness = setupSmooth();

    expect(harness.state.value.value).toEqual([]);

    const a = createBlock('a', paragraph('abc'), 0, 3);

    const empty = createBlock('empty', root(), 1, 3);

    const b = createBlock('b', paragraph('de'), 2, 3);

    const forkA = jest.spyOn(a.block, 'fork');

    const forkEmpty = jest.spyOn(empty.block, 'fork');

    const forkB = jest.spyOn(b.block, 'fork');

    harness.source.next([a.block, empty.block, b.block]);

    const ticker = latest(PrimarySmoothTicker.instances);

    expect(forkA).toHaveBeenCalledTimes(1);

    for (const time of [16, 32, 48]) {
      ticker.tick(time);
    }

    expect(harness.state.value.value.map((block) => block.meta.value.key)).toEqual(['a']);

    expect(forkEmpty).not.toHaveBeenCalled();

    expect(forkB).not.toHaveBeenCalled();

    ticker.tick(64);

    const output = harness.state.value.value;

    const emptyFork = output.find((block) => block.meta.value.key === 'empty');

    expect(emptyFork).toBeDefined();

    const destroyEmpty = jest.spyOn(emptyFork!, 'destroy');

    expect(output.map((block) => block.meta.value.key)).toEqual(['a', 'empty', 'b']);

    expect(output.map((block) => block.range.value)).toEqual([null, null, { start: 0, end: 1 }]);

    expect(forkEmpty).toHaveBeenCalledTimes(1);

    expect(forkB).toHaveBeenCalledTimes(1);

    ticker.tick(80);

    harness.source.next([a.block, empty.block]);

    expect(harness.state.value.value.map((block) => block.meta.value.key)).toEqual(['a']);

    expect(firstBlock(harness.state.value.value).range.value).toEqual({ start: 0, end: 3 });

    expect(firstBlock(harness.state.value.value).meta.value.blockCount).toBe(1);

    expect(destroyEmpty).toHaveBeenCalledTimes(1);

    harness.state.destroy();
  });
});
