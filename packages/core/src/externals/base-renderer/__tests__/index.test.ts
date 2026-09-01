import { type IReactiveState, MutableState, ReactiveState } from 'reactive';
import { describe, expect, test, vi } from 'vitest';

import type { IBlockMeta, IBlockState } from '../../../states/base';

import {
  BaseRendererStateClosure,
  type BaseRendererStateClosureInputs,
  type IRenderPatchItem,
} from '..';
import {
  BaseRenderPlugin,
  type IRenderPlugin,
  type IRenderPluginMatchParams,
  type IRenderPluginRenderParams,
} from '../../base-render-plugin';

interface TestRenderConfig {
  suffix: string;
}

interface RenderedItem {
  key: string;

  content: IReactiveState<string>;

  plugins: IRenderPlugin<string, string, RenderedItem, TestRenderConfig>[];

  patches: IReactiveState<IRenderPatchItem<RenderedItem>[]>;
}

class TestRenderPlugin extends BaseRenderPlugin<string, string, RenderedItem, TestRenderConfig> {
  match({ node }: IRenderPluginMatchParams<string, string>) {
    return Boolean(node);
  }

  render({
    node,
    render,
    suffix,
  }: IRenderPluginRenderParams<string, string, RenderedItem, TestRenderConfig>) {
    return render(`${node}${suffix}`);
  }
}

class TestRendererStateClosure extends BaseRendererStateClosure<
  string,
  string,
  string,
  RenderedItem,
  TestRenderConfig
> {
  readonly renderItemSpy = vi.fn((item: IBlockState<string>): RenderedItem => {
    const { patches, plugins } = this.inputs;

    return {
      key: item.meta.value.key,
      content: item.value,
      plugins: plugins.value,
      patches,
    };
  });

  protected renderItem(item: IBlockState<string>) {
    return this.renderItemSpy(item);
  }
}

const createBlock = (key: string, sourceText: string): IBlockState<string> => {
  const value = MutableState.of(sourceText);
  const meta = MutableState.of<IBlockMeta>({
    key,
    sourceText,
    charStart: 0,
    charEnd: sourceText.length,
    currentIndex: 0,
    blockCount: 1,
  });
  const block: IBlockState<string> = {
    value,
    meta,
    range: ReactiveState.of(null),
    length: ReactiveState.of(sourceText.length),
    baseLength: ReactiveState.of(sourceText.length),
    fork: () => block,
    destroy: () => {
      value.complete();
      meta.complete();
    },
  };

  return block;
};

const setupRenderer = (blocks: IBlockState<string>[]) => {
  const source = MutableState.of(blocks);
  const patches = MutableState.of<IRenderPatchItem<RenderedItem>[]>([]);
  const initialPlugin = new TestRenderPlugin();
  const plugins = MutableState.of<
    BaseRenderPlugin<string, string, RenderedItem, TestRenderConfig>[]
  >([initialPlugin]);
  const inputs: BaseRendererStateClosureInputs<
    string,
    string,
    string,
    RenderedItem,
    TestRenderConfig
  > = {
    source,
    patches,
    plugins,
  };
  const renderer = new TestRendererStateClosure(inputs);

  return { initialPlugin, patches, plugins, renderer, source };
};

const getObserverCount = (state: IReactiveState<unknown>) => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

describe('BaseRendererStateClosure', () => {
  test('lazily renders new block keys and reuses cached results in source order', () => {
    const first = createBlock('first', 'first');
    const second = createBlock('second', 'second');
    const { renderer, source } = setupRenderer([first, second]);

    expect(renderer.renderItemSpy).not.toHaveBeenCalled();

    const initial = renderer.value.value;

    expect(initial.map((item) => item.key)).toEqual(['first', 'second']);

    expect(renderer.renderItemSpy).toHaveBeenCalledTimes(2);

    const replacementFirst = createBlock('first', 'replacement');
    const third = createBlock('third', 'third');

    source.next([second, replacementFirst, third]);

    const reordered = renderer.value.value;

    expect(reordered).toEqual([initial[1], initial[0], expect.objectContaining({ key: 'third' })]);

    expect(renderer.renderItemSpy).toHaveBeenCalledTimes(3);

    source.next([replacementFirst, second]);

    expect(renderer.value.value).toEqual([initial[0], initial[1]]);

    expect(renderer.renderItemSpy).toHaveBeenCalledTimes(3);
  });

  test('fully rerenders only when plugin instances or order change', () => {
    const first = createBlock('first', 'first');
    const second = createBlock('second', 'second');
    const { initialPlugin, plugins, renderer } = setupRenderer([first, second]);
    const initial = renderer.value.value;

    plugins.next([initialPlugin]);

    expect(renderer.value.value).toBe(initial);

    expect(renderer.renderItemSpy).toHaveBeenCalledTimes(2);

    const nextPlugin = new TestRenderPlugin();

    plugins.next([initialPlugin, nextPlugin]);

    const updated = renderer.value.value;

    expect(updated[0]).not.toBe(initial[0]);
    expect(updated[1]).not.toBe(initial[1]);
    expect(updated.map((item) => item.plugins)).toEqual([
      [initialPlugin, nextPlugin],
      [initialPlugin, nextPlugin],
    ]);

    expect(renderer.renderItemSpy).toHaveBeenCalledTimes(4);

    plugins.next([nextPlugin, initialPlugin]);

    const reordered = renderer.value.value;

    expect(reordered[0]).not.toBe(updated[0]);
    expect(reordered[1]).not.toBe(updated[1]);
    expect(reordered.map((item) => item.plugins)).toEqual([
      [nextPlugin, initialPlugin],
      [nextPlugin, initialPlugin],
    ]);

    expect(renderer.renderItemSpy).toHaveBeenCalledTimes(6);
  });

  test('leaves block content and patch updates to rendered results', () => {
    const block = createBlock('block', 'initial');
    const { patches, renderer } = setupRenderer([block]);
    const [rendered] = renderer.value.value;
    const next = vi.fn();

    renderer.value.subscribe(next);
    next.mockClear();

    (block.value as MutableState<string>).next('updated');
    patches.next([
      {
        key: 'patch',
        render: () => rendered as RenderedItem,
      },
    ]);

    expect(rendered?.content.value).toBe('updated');
    expect(rendered?.patches).toBe(patches);

    expect(renderer.renderItemSpy).toHaveBeenCalledOnce();

    expect(next).not.toHaveBeenCalled();
  });

  test('destroy completes the renderer without destroying its inputs', () => {
    const block = createBlock('block', 'value');
    const { patches, plugins, renderer, source } = setupRenderer([block]);
    const complete = vi.fn();

    renderer.value.subscribe({ complete });

    expect(getObserverCount(source)).toBeGreaterThan(0);
    expect(getObserverCount(plugins)).toBeGreaterThan(0);

    renderer.destroy();
    renderer.destroy();

    expect(complete).toHaveBeenCalledOnce();
    expect(renderer.value.closed).toBe(true);
    expect(source.closed).toBe(false);
    expect(patches.closed).toBe(false);
    expect(plugins.closed).toBe(false);
    expect(getObserverCount(source)).toBe(0);
    expect(getObserverCount(plugins)).toBe(0);
  });
});
