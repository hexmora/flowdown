import type { Element, ElementContent, Parent, RootContent } from 'hast';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';

import {
  ApplyRepairsRemarkPlugin,
  BaseRehypePlugin,
  BaseRemarkPlugin,
  BaseRepairPlugin,
  DanglingFootnoteRepairPlugin,
  HoistFootnoteRehypePlugin,
  IncompleteImageRepairPlugin,
  PatchesRemarkPlugin,
  PRESET_REHYPE_PLUGINS,
  PRESET_REMARK_PLUGINS,
  PRESET_REPAIR_PLUGINS,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import { type IReactiveState, MutableState, ReactiveState } from '@flowdown/reactive';
import {
  type IBasePluginConfig,
  type IPluggable,
  type IRehypePlugin,
  type IRemarkPlugin,
  type IRepairPlugin,
  PluginPriority,
  type RepairPluginRunner,
  type RepairPluginSystemConfig,
} from '@flowdown/types';
import { first, last, nth } from 'lodash-es';
import { beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { HastRoot } from '../../../typings';
import type { IBlockState } from '../../base';
import type { BlockCompilerConfig } from '../../hast/block-compiler';

import { CoreStateClosure, type IPatchItem } from '..';
import {
  BaseRendererStateClosure,
  BaseRenderPlugin,
  type IRenderPatchItem,
  type IRenderPluggable,
  type IRenderPlugin,
} from '../../../externals';

interface AppendRemarkPluginConfig {
  suffix?: string;
}

class AppendRemarkPlugin extends BaseRemarkPlugin {
  static readonly key = 'remark-test-append';

  static readonly destroyed = vi.fn();

  readonly config: IBasePluginConfig = { priority: PluginPriority.Default };

  private readonly innerConfig: AppendRemarkPluginConfig;

  plugin: Plugin<[], Root, Root> = () => (tree) => {
    const tail = last(tree.children);

    if (tail?.type === 'paragraph') {
      tail.children.push({ type: 'text', value: this.innerConfig.suffix ?? '' });
    }
  };

  constructor(config: AppendRemarkPluginConfig = {}) {
    super();

    this.innerConfig = { ...config };
  }

  override destroy() {
    if (!this.destroyed) {
      AppendRemarkPlugin.destroyed(this.innerConfig.suffix);
    }

    super.destroy();
  }
}

class AppendRehypePlugin extends BaseRehypePlugin {
  static readonly key = 'rehype-test-append';

  static readonly destroyed = vi.fn();

  config = { priority: PluginPriority.Lowest };

  plugin: Plugin<[], HastRoot, HastRoot> = () => (tree) => {
    tree.children.push({ type: 'text', value: '|rehype' });
  };

  override destroy() {
    if (!this.destroyed) {
      AppendRehypePlugin.destroyed();
    }

    super.destroy();
  }
}

interface EndingMarkerRepairPluginConfig {
  marker?: string;
}

class EndingMarkerRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-test-ending-marker';

  static readonly destroyed = vi.fn();

  readonly config: RepairPluginSystemConfig = {
    ending: true,
    priority: PluginPriority.Lowest,
  };

  private readonly innerConfig: EndingMarkerRepairPluginConfig;

  runner: RepairPluginRunner = ({ node }) => {
    if (node.type !== 'root') {
      return;
    }

    const tail = last(node.children);

    if (tail?.type === 'paragraph') {
      tail.children.push({ type: 'text', value: this.innerConfig.marker ?? '|ending' });
    }
  };

  constructor(config: EndingMarkerRepairPluginConfig = {}) {
    super();

    this.innerConfig = { ...config };
  }

  override destroy() {
    if (!this.destroyed) {
      EndingMarkerRepairPlugin.destroyed(this.innerConfig.marker);
    }

    super.destroy();
  }
}

const DEFAULT_CONFIG: BlockCompilerConfig = {
  repair: false,
  repairEnding: false,
  footnote: false,
  tex: false,
};

interface RenderedBlock extends IBlockState<HastRoot> {
  renderPatches: IReactiveState<IRenderPatchItem<RenderedBlock>[]>;

  renderPlugins: IRenderPlugin<ElementContent, Parent, RenderedBlock>[];
}

class TestRenderPlugin extends BaseRenderPlugin<ElementContent, Parent, RenderedBlock> {
  static readonly key = 'render-test';

  static readonly constructed = vi.fn();

  static readonly destroyed = vi.fn();

  constructor() {
    super();

    TestRenderPlugin.constructed();
  }

  match() {
    return true;
  }

  render(): RenderedBlock {
    throw new Error('Test render plugins are not invoked by the test renderer.');
  }

  override destroy() {
    if (!this.destroyed) {
      TestRenderPlugin.destroyed();
    }

    super.destroy();
  }
}

class TestRendererStateClosure extends BaseRendererStateClosure<
  HastRoot,
  ElementContent,
  Parent,
  RenderedBlock
> {
  protected renderItem(item: IBlockState<HastRoot>): RenderedBlock {
    return {
      baseLength: item.baseLength,
      destroy: () => item.destroy(),
      fork: (params) => item.fork(params),
      length: item.length,
      meta: item.meta,
      range: item.range,
      renderPatches: this.patches,
      renderPlugins: this.plugins.value,
      value: item.value,
    };
  }
}

const collectText = (node: HastRoot | RootContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  if ('children' in node) {
    return node.children.map((child) => collectText(child)).join('');
  }

  return '';
};

const findElement = (
  node: HastRoot | RootContent,
  predicate: (element: Element) => boolean,
): Element | undefined => {
  if (node.type === 'element' && predicate(node)) {
    return node;
  }

  if (!('children' in node)) {
    return undefined;
  }

  for (const child of node.children) {
    const result = findElement(child, predicate);

    if (result) {
      return result;
    }
  }

  return undefined;
};

const getBlockTree = (block: RenderedBlock | undefined): HastRoot => {
  if (!block) {
    throw new Error('Expected a compiled block.');
  }

  return block.value.value;
};

const getFirstBlockTree = (state: {
  readonly value: IReactiveState<RenderedBlock[]>;
}): HastRoot => {
  return getBlockTree(first(state.value.value));
};

const getObserverCount = (state: IReactiveState<unknown>): number => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

const setupCoreStateClosure = (initialText = 'base') => {
  const text = MutableState.of(initialText);
  const patches = MutableState.of<IPatchItem<RenderedBlock>[]>([]);
  const config = MutableState.of(DEFAULT_CONFIG);
  const remarks = MutableState.of<IPluggable<IRemarkPlugin, unknown>[]>([
    [AppendRemarkPlugin, { suffix: '|remark' }] as unknown as IPluggable<IRemarkPlugin, unknown>,
  ]);
  const rehypes = MutableState.of<IPluggable<IRehypePlugin, unknown>[]>([AppendRehypePlugin]);
  const repairs = MutableState.of<IPluggable<IRepairPlugin, unknown>[]>([EndingMarkerRepairPlugin]);
  const renders = MutableState.of<
    IRenderPluggable<ElementContent, Parent, RenderedBlock, {}, unknown>[]
  >([]);
  const state = new CoreStateClosure({
    Renderer: TestRendererStateClosure,
    text,
    patches,
    config,
    renders,
    remarks,
    rehypes,
    repairs,
  });

  return {
    config,
    patches,
    rehypes,
    remarks,
    renders,
    repairs,
    state,
    text,
  };
};

beforeEach(() => {
  AppendRemarkPlugin.destroyed.mockClear();
  AppendRehypePlugin.destroyed.mockClear();
  EndingMarkerRepairPlugin.destroyed.mockClear();
  TestRenderPlugin.constructed.mockClear();
  TestRenderPlugin.destroyed.mockClear();
});

describe('CoreStateClosure', () => {
  test('exposes a reactive rendered value and preset plugin classes', () => {
    expectTypeOf<CoreStateClosure<RenderedBlock>['value']>().toEqualTypeOf<
      IReactiveState<RenderedBlock[]>
    >();

    expect(PRESET_REMARK_PLUGINS).toContain(SyntaxMathRemarkPlugin);
    expect(PRESET_REHYPE_PLUGINS).toContain(HoistFootnoteRehypePlugin);
    expect(PRESET_REPAIR_PLUGINS).toContain(DanglingFootnoteRepairPlugin);
  });

  test('builds from direct inputs with default plugin sources', () => {
    const state = new CoreStateClosure({
      Renderer: TestRendererStateClosure,
      text: 'base',
      patches: ReactiveState.of<IPatchItem<RenderedBlock>[]>([]),
      config: DEFAULT_CONFIG,
      renders: ReactiveState.of<
        IRenderPluggable<ElementContent, Parent, RenderedBlock, {}, unknown>[]
      >([]),
    });

    expect(collectText(getFirstBlockTree(state))).toBe('base');

    expect(state.value.closed).toBe(true);

    state.destroy();
  });

  test('uses the injected renderer and reacts to render plugin changes', () => {
    const harness = setupCoreStateClosure();
    const initial = first(harness.state.value.value);

    harness.renders.next([TestRenderPlugin]);

    const updated = first(harness.state.value.value);
    const plugin = first(updated?.renderPlugins ?? []);

    expect(updated).not.toBe(initial);
    expect(plugin).toBeInstanceOf(TestRenderPlugin);
    expect(TestRenderPlugin.constructed).toHaveBeenCalledOnce();

    harness.state.destroy();

    expect(TestRenderPlugin.destroyed).toHaveBeenCalledOnce();
  });

  test('reacts to configured extra pluggables while preserving block identity', () => {
    const harness = setupCoreStateClosure();
    const initialBlock = first(harness.state.value.value);

    expect(initialBlock).toBeDefined();
    expect(collectText(getBlockTree(initialBlock))).toBe('base|remark|rehype');

    harness.remarks.next([
      [AppendRemarkPlugin, { suffix: '|updated' }] as unknown as IPluggable<IRemarkPlugin, unknown>,
    ]);

    const configuredBlock = first(harness.state.value.value);

    expect(configuredBlock).toBe(initialBlock);
    expect(collectText(getBlockTree(configuredBlock))).toBe('base|updated|rehype');
    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledOnce();
    expect(AppendRehypePlugin.destroyed).not.toHaveBeenCalled();

    harness.remarks.next([]);
    harness.rehypes.next([]);

    const withoutExtras = first(harness.state.value.value);

    expect(withoutExtras).toBe(initialBlock);
    expect(collectText(getBlockTree(withoutExtras))).toBe('base');
    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledTimes(2);
    expect(AppendRehypePlugin.destroyed).toHaveBeenCalledOnce();
  });

  test('gates math and dangling-footnote behavior through core config', () => {
    const math = setupCoreStateClosure('$x$');

    math.remarks.next([]);
    math.rehypes.next([]);
    math.repairs.next([]);

    expect(
      findElement(getFirstBlockTree(math.state), (element) => {
        return element.properties?.dataType === 'inline-math';
      }),
    ).toBeUndefined();

    math.config.next({ ...DEFAULT_CONFIG, tex: true });

    expect(
      findElement(getFirstBlockTree(math.state), (element) => {
        return element.properties?.dataType === 'inline-math';
      }),
    ).toBeDefined();

    const footnote = setupCoreStateClosure('first[^12');

    footnote.remarks.next([]);
    footnote.rehypes.next([]);
    footnote.repairs.next([]);
    footnote.config.next({
      ...DEFAULT_CONFIG,
      repair: true,
      repairEnding: true,
      footnote: false,
    });

    const disabled = collectText(getFirstBlockTree(footnote.state));

    footnote.config.next({ ...footnote.config.value, footnote: true });

    const enabled = collectText(getFirstBlockTree(footnote.state));

    expect(disabled).toContain('[^12');
    expect(enabled).toBe('first');
  });

  test('lets framework-managed remark fields override user tuple options', () => {
    const harness = setupCoreStateClosure('abc');
    const renderPatch = vi.fn(() => first(harness.state.value.value)!);

    harness.remarks.next([
      [
        PatchesRemarkPlugin,
        { patches: [{ key: 'ignored', range: [0, 0] }] },
      ] as unknown as IPluggable<IRemarkPlugin, unknown>,
    ]);
    harness.rehypes.next([]);
    harness.patches.next([{ key: 'actual', range: [1, 1], render: renderPatch }]);

    const patchTree = getFirstBlockTree(harness.state);
    const renderedBlock = first(harness.state.value.value);

    expect(
      findElement(patchTree, (element) => element.properties?.dataPatchKey === 'actual'),
    ).toBeDefined();
    expect(
      findElement(patchTree, (element) => element.properties?.dataPatchKey === 'ignored'),
    ).toBeUndefined();
    expect(renderedBlock?.renderPatches.value).toEqual([{ key: 'actual', render: renderPatch }]);

    const updatedRenderPatch = vi.fn(() => renderedBlock!);

    harness.patches.next([{ key: 'actual', range: [2, 2], render: updatedRenderPatch }]);

    const updatedTree = getFirstBlockTree(harness.state);
    const updatedParagraph = findElement(updatedTree, (element) => element.tagName === 'p');

    expect(updatedParagraph?.children).toMatchObject([
      { type: 'text', value: 'ab' },
      { properties: { dataPatchKey: 'actual' }, type: 'element' },
      { type: 'text', value: 'c' },
    ]);
    expect(renderedBlock?.renderPatches.value).toEqual([
      { key: 'actual', render: updatedRenderPatch },
    ]);

    const math = setupCoreStateClosure('prefix$a+b');

    math.remarks.next([
      [SyntaxMathRemarkPlugin, { repairEnding: true }] as unknown as IPluggable<
        IRemarkPlugin,
        unknown
      >,
    ]);
    math.rehypes.next([]);
    math.repairs.next([]);
    math.config.next({ ...DEFAULT_CONFIG, tex: true, repairEnding: true });

    expect(
      findElement(getFirstBlockTree(math.state), (element) => {
        return element.properties?.dataType === 'inline-math';
      }),
    ).toBeUndefined();

    math.remarks.next([
      [SyntaxMathRemarkPlugin, { repairEnding: false }] as unknown as IPluggable<
        IRemarkPlugin,
        unknown
      >,
    ]);
    math.config.next({
      ...DEFAULT_CONFIG,
      tex: true,
      repair: true,
      repairEnding: true,
    });

    expect(
      findElement(getFirstBlockTree(math.state), (element) => {
        return element.properties?.dataType === 'inline-math';
      }),
    ).toBeDefined();

    const ending = setupCoreStateClosure('first\n\nsecond');

    ending.remarks.next([
      [ApplyRepairsRemarkPlugin, { ending: false, plugins: [] }] as unknown as IPluggable<
        IRemarkPlugin,
        unknown
      >,
    ]);
    ending.rehypes.next([]);
    ending.config.next({ ...DEFAULT_CONFIG, repair: true, repairEnding: true });

    const values = ending.state.value.value.map((block) => collectText(block.value.value));

    expect(values).toEqual(['first', 'second|ending']);
  });

  test('reacts to enabled repair extras, their configs, and list changes', () => {
    const harness = setupCoreStateClosure('base');

    harness.remarks.next([]);
    harness.rehypes.next([]);

    expect(collectText(getFirstBlockTree(harness.state))).toBe('base');

    harness.config.next({
      ...DEFAULT_CONFIG,
      repair: true,
      repairEnding: true,
    });

    expect(collectText(getFirstBlockTree(harness.state))).toBe('base|ending');

    harness.repairs.next([]);

    expect(collectText(getFirstBlockTree(harness.state))).toBe('base');
    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledOnce();

    harness.repairs.next([
      [EndingMarkerRepairPlugin, { marker: '|configured' }] as unknown as IPluggable<
        IRepairPlugin,
        unknown
      >,
    ]);

    expect(collectText(getFirstBlockTree(harness.state))).toBe('base|configured');
    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledOnce();
  });

  test('uses an extra configured tuple for a preset class without appending a duplicate', () => {
    const harness = setupCoreStateClosure('prefix ![tail');

    harness.remarks.next([]);
    harness.rehypes.next([]);
    harness.repairs.next([
      [IncompleteImageRepairPlugin, { strategy: 'discard' }] as unknown as IPluggable<
        IRepairPlugin,
        unknown
      >,
    ]);
    harness.config.next({
      ...DEFAULT_CONFIG,
      repair: true,
      repairEnding: true,
    });

    const tree = getFirstBlockTree(harness.state);

    expect(findElement(tree, (element) => element.tagName === 'img')).toBeUndefined();
    expect(collectText(tree)).toBe('prefix ');
  });

  test('keeps the compiled block graph reactive without taking ownership of inputs', () => {
    const harness = setupCoreStateClosure('first\n\nsecond');
    const initial = harness.state.value.value;

    harness.text.next('updated\n\nsecond\n\nthird');

    const updated = harness.state.value.value;

    expect(updated).toHaveLength(3);
    expect(first(updated)).toBe(first(initial));
    expect(nth(updated, 1)).toBe(nth(initial, 1));
    expect(updated.map((block) => collectText(block.value.value))).toEqual([
      'updated|remark|rehype',
      'second|remark|rehype',
      'third|remark|rehype',
    ]);

    const inputs = [
      harness.text,
      harness.patches,
      harness.config,
      harness.remarks,
      harness.rehypes,
      harness.renders,
      harness.repairs,
    ];

    expect(inputs.every((state) => getObserverCount(state) > 0)).toBe(true);

    harness.state.destroy();
    harness.state.destroy();

    expect(harness.state.value).toBeDefined();
    expect(harness.text.closed).toBe(false);
    expect(harness.patches.closed).toBe(false);
    expect(harness.config.closed).toBe(false);
    expect(harness.remarks.closed).toBe(false);
    expect(harness.rehypes.closed).toBe(false);
    expect(harness.renders.closed).toBe(false);
    expect(harness.repairs.closed).toBe(false);
    expect(inputs.map(getObserverCount)).toEqual(inputs.map(() => 0));
    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledTimes(3);
    expect(AppendRehypePlugin.destroyed).toHaveBeenCalledOnce();
  });

  test('releases per-block descriptor scopes as blocks leave the graph', () => {
    const harness = setupCoreStateClosure('first\n\nsecond\n\nthird');

    expect(harness.state.value.value).toHaveLength(3);

    const initialRemarkObservers = getObserverCount(harness.remarks);

    expect(initialRemarkObservers).toBe(3);

    harness.text.next('first');

    expect(harness.state.value.value).toHaveLength(1);
    expect(getObserverCount(harness.remarks)).toBe(initialRemarkObservers - 2);
    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledTimes(2);

    harness.text.next('first\n\nfourth');

    expect(harness.state.value.value).toHaveLength(2);
    expect(getObserverCount(harness.remarks)).toBe(initialRemarkObservers - 1);
    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledTimes(2);

    harness.state.destroy();

    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledTimes(4);
    expect(AppendRehypePlugin.destroyed).toHaveBeenCalledOnce();
  });

  test('releases per-block repair plugins as blocks leave the graph', () => {
    const harness = setupCoreStateClosure('first\n\nsecond');

    harness.remarks.next([]);
    harness.rehypes.next([]);
    harness.config.next({
      ...DEFAULT_CONFIG,
      repair: true,
      repairEnding: true,
    });

    expect(harness.state.value.value.map((block) => collectText(block.value.value))).toEqual([
      'first',
      'second|ending',
    ]);
    expect(EndingMarkerRepairPlugin.destroyed).not.toHaveBeenCalled();

    harness.text.next('first');

    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledOnce();

    harness.text.next('');

    expect(harness.state.value.value).toEqual([]);
    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledTimes(2);

    harness.text.next('rebuilt');

    expect(collectText(getFirstBlockTree(harness.state))).toBe('rebuilt|ending');
    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledTimes(2);

    harness.state.destroy();

    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledTimes(3);
    expect(harness.repairs.closed).toBe(false);
  });

  test('destroying before initialization builds no graph', () => {
    const harness = setupCoreStateClosure();

    harness.state.destroy();
    harness.state.destroy();

    expect(() => harness.state.value).toThrowError('Cannot set up a destroyed state closure.');
    expect(AppendRemarkPlugin.destroyed).not.toHaveBeenCalled();
    expect(AppendRehypePlugin.destroyed).not.toHaveBeenCalled();
  });
});
