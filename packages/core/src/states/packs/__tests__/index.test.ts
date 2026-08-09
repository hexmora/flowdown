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
  IncompleteCodeFenceRepairPlugin,
  IncompleteImageRepairPlugin,
  type IncompleteImageRepairPluginConfig,
  PatchesRemarkPlugin,
  PRESET_REHYPE_PLUGINS,
  PRESET_REMARK_PLUGINS,
  PRESET_REPAIR_PLUGINS,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import { type IReactiveState, MutableState, ReactiveState } from '@flowdown/reactive';
import {
  type IBasePluginConfig,
  type IRehypePlugin,
  type IRemarkPlugin,
  type IRepairPlugin,
  type PluginClass,
  PluginPriority,
  type RepairPluginRunner,
  type RepairPluginSystemConfig,
} from '@flowdown/types';
import { first, last, nth } from 'lodash-es';
import { beforeEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { HastRoot } from '../../../typings';
import type { IBlockState } from '../../base';
import type { BlockCompilerConfig } from '../../hast/block-compiler';

import { CoreStateClosure, type IPatchItem, type PluginConfigs } from '..';
import {
  BaseRendererStateClosure,
  BaseRenderPlugin,
  type IRenderPatchItem,
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

  renderPlugins: BaseRenderPlugin<ElementContent, Parent, RenderedBlock>[];
}

class TestRenderPlugin extends BaseRenderPlugin<ElementContent, Parent, RenderedBlock> {
  match() {
    return true;
  }

  render(): RenderedBlock {
    throw new Error('Test render plugins are not invoked by the test renderer.');
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

type TestPluginConfigs = PluginConfigs &
  PluginConfigs<typeof AppendRemarkPlugin | typeof EndingMarkerRepairPlugin>;

const asRuntimePluginConfigs = (configs: Record<string, unknown>): TestPluginConfigs => {
  return configs as TestPluginConfigs;
};

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
  const pluginConfigs = MutableState.of<TestPluginConfigs>({
    [AppendRemarkPlugin.key]: { suffix: '|remark' },
  });
  const remarks = MutableState.of<(typeof AppendRemarkPlugin)[]>([AppendRemarkPlugin]);
  const rehypes = MutableState.of<(typeof AppendRehypePlugin)[]>([AppendRehypePlugin]);
  const repairs = MutableState.of<(typeof EndingMarkerRepairPlugin)[]>([EndingMarkerRepairPlugin]);
  const renders = MutableState.of<BaseRenderPlugin<ElementContent, Parent, RenderedBlock>[]>([]);
  const state = new CoreStateClosure({
    Renderer: TestRendererStateClosure,
    text,
    patches,
    config,
    renders,
    pluginConfigs,
    remarks,
    rehypes,
    repairs,
  });

  return {
    config,
    patches,
    pluginConfigs,
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
});

describe('CoreStateClosure', () => {
  test('derives plugin config keys and constructor config shapes', () => {
    const config: PluginConfigs<typeof AppendRemarkPlugin> = {
      [AppendRemarkPlugin.key]: { suffix: '|typed' },
    };
    const managedApplyConfig: PluginConfigs<typeof ApplyRepairsRemarkPlugin> = {
      [ApplyRepairsRemarkPlugin.key]: { safe: false },
    };
    const presetRepairConfig: PluginConfigs<typeof IncompleteImageRepairPlugin> = {
      [IncompleteImageRepairPlugin.key]: { strategy: 'discard' },
    };

    expectTypeOf(config[AppendRemarkPlugin.key]).toEqualTypeOf<
      AppendRemarkPluginConfig | undefined
    >();
    expectTypeOf(managedApplyConfig[ApplyRepairsRemarkPlugin.key]).toEqualTypeOf<
      { safe?: boolean } | undefined
    >();
    expectTypeOf(presetRepairConfig[IncompleteImageRepairPlugin.key]).toEqualTypeOf<
      IncompleteImageRepairPluginConfig | undefined
    >();
    expectTypeOf<CoreStateClosure<RenderedBlock>['value']>().toEqualTypeOf<
      IReactiveState<RenderedBlock[]>
    >();
    expectTypeOf(AppendRemarkPlugin).toMatchTypeOf<PluginClass<IRemarkPlugin>>();
    expectTypeOf(AppendRehypePlugin).toMatchTypeOf<PluginClass<IRehypePlugin>>();
    expectTypeOf(EndingMarkerRepairPlugin).toMatchTypeOf<PluginClass<IRepairPlugin>>();
    expectTypeOf(PRESET_REMARK_PLUGINS).toEqualTypeOf<PluginClass<IRemarkPlugin>[]>();
    expectTypeOf(PRESET_REHYPE_PLUGINS).toEqualTypeOf<PluginClass<IRehypePlugin>[]>();
    expectTypeOf(PRESET_REPAIR_PLUGINS).toEqualTypeOf<PluginClass<IRepairPlugin>[]>();
    expectTypeOf(SyntaxMathRemarkPlugin).toMatchTypeOf<PluginClass<IRemarkPlugin>>();
    expectTypeOf(HoistFootnoteRehypePlugin).toMatchTypeOf<PluginClass<IRehypePlugin>>();
    expectTypeOf(DanglingFootnoteRepairPlugin).toMatchTypeOf<PluginClass<IRepairPlugin>>();

    const invalidConfig: PluginConfigs<typeof AppendRemarkPlugin> = {
      // @ts-expect-error The config is derived from AppendRemarkPlugin's constructor.
      [AppendRemarkPlugin.key]: { missing: true },
    };
    const invalidKey: PluginConfigs<typeof AppendRemarkPlugin> = {
      // @ts-expect-error Unknown static plugin keys are rejected.
      'remark-unknown': {},
    };
    const invalidApplyPlugins: PluginConfigs<typeof ApplyRepairsRemarkPlugin> = {
      [ApplyRepairsRemarkPlugin.key]: {
        // @ts-expect-error Repair instances are managed by CoreStateClosure.
        plugins: [],
      },
    };
    const invalidApplyEnding: PluginConfigs<typeof ApplyRepairsRemarkPlugin> = {
      [ApplyRepairsRemarkPlugin.key]: {
        // @ts-expect-error Ending state is managed by CoreStateClosure.
        ending: false,
      },
    };
    // @ts-expect-error Math ending repair is managed by CoreStateClosure.
    const invalidMathConfig: PluginConfigs<typeof SyntaxMathRemarkPlugin> = {
      [SyntaxMathRemarkPlugin.key]: { repairEnding: false },
    };
    // @ts-expect-error Block patches are managed by CoreStateClosure.
    const invalidPatchesConfig: PluginConfigs<typeof PatchesRemarkPlugin> = {
      [PatchesRemarkPlugin.key]: { patches: [] },
    };
    // @ts-expect-error Configless preset plugins do not accept per-key config.
    const invalidConfiglessRepair: PluginConfigs<typeof IncompleteCodeFenceRepairPlugin> = {
      [IncompleteCodeFenceRepairPlugin.key]: {},
    };

    expect(invalidConfig).toBeDefined();
    expect(invalidKey).toBeDefined();
    expect(invalidApplyPlugins).toBeDefined();
    expect(invalidApplyEnding).toBeDefined();
    expect(invalidMathConfig).toBeDefined();
    expect(invalidPatchesConfig).toBeDefined();
    expect(invalidConfiglessRepair).toBeDefined();
  });

  test('builds from direct inputs with default plugin sources', () => {
    const state = new CoreStateClosure({
      Renderer: TestRendererStateClosure,
      text: 'base',
      patches: ReactiveState.of<IPatchItem<RenderedBlock>[]>([]),
      config: DEFAULT_CONFIG,
      renders: ReactiveState.of<BaseRenderPlugin<ElementContent, Parent, RenderedBlock>[]>([]),
    });

    expect(collectText(getFirstBlockTree(state))).toBe('base');

    expect(state.value.closed).toBe(true);

    state.destroy();
  });

  test('uses the injected renderer and reacts to render plugin changes', () => {
    const harness = setupCoreStateClosure();
    const initial = first(harness.state.value.value);
    const plugin = new TestRenderPlugin();

    harness.renders.next([plugin]);

    const updated = first(harness.state.value.value);

    expect(updated).not.toBe(initial);
    expect(updated?.renderPlugins).toEqual([plugin]);

    harness.state.destroy();
    plugin.destroy();
  });

  test('reacts to extra class lists and per-key configs while preserving block identity', () => {
    const harness = setupCoreStateClosure();
    const initialBlock = first(harness.state.value.value);

    expect(initialBlock).toBeDefined();
    expect(collectText(getBlockTree(initialBlock))).toBe('base|remark|rehype');

    harness.remarks.next([AppendRemarkPlugin, AppendRemarkPlugin]);

    expect(collectText(getFirstBlockTree(harness.state))).toBe('base|remark|rehype');
    expect(AppendRemarkPlugin.destroyed).not.toHaveBeenCalled();

    harness.pluginConfigs.next({
      [AppendRemarkPlugin.key]: { suffix: '|updated' },
    });

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

  test('injects block patches and last-block ending after user plugin configs', () => {
    const harness = setupCoreStateClosure('abc');
    const renderPatch = vi.fn(() => first(harness.state.value.value)!);

    harness.remarks.next([]);
    harness.rehypes.next([]);
    harness.pluginConfigs.next(
      asRuntimePluginConfigs({
        [PatchesRemarkPlugin.key]: {
          patches: [{ key: 'ignored', range: [0, 0] }],
        },
      }),
    );
    harness.patches.next([{ key: 'actual', range: [1, 1], render: renderPatch }]);

    const patchTree = getFirstBlockTree(harness.state);
    const renderedBlock = first(harness.state.value.value);

    expect(
      findElement(patchTree, (element) => element.properties?.dataParserKey === 'actual'),
    ).toBeDefined();
    expect(
      findElement(patchTree, (element) => element.properties?.dataParserKey === 'ignored'),
    ).toBeUndefined();
    expect(renderedBlock?.renderPatches.value).toEqual([{ key: 'actual', render: renderPatch }]);

    const updatedRenderPatch = vi.fn(() => renderedBlock!);

    harness.patches.next([{ key: 'actual', range: [2, 2], render: updatedRenderPatch }]);

    const updatedTree = getFirstBlockTree(harness.state);
    const updatedParagraph = findElement(updatedTree, (element) => element.tagName === 'p');

    expect(updatedParagraph?.children).toMatchObject([
      { type: 'text', value: 'ab' },
      { properties: { dataParserKey: 'actual' }, type: 'element' },
      { type: 'text', value: 'c' },
    ]);
    expect(renderedBlock?.renderPatches.value).toEqual([
      { key: 'actual', render: updatedRenderPatch },
    ]);

    const math = setupCoreStateClosure('prefix$a+b');

    math.remarks.next([]);
    math.rehypes.next([]);
    math.repairs.next([]);
    math.pluginConfigs.next(
      asRuntimePluginConfigs({
        [SyntaxMathRemarkPlugin.key]: { repairEnding: true },
      }),
    );
    math.config.next({ ...DEFAULT_CONFIG, tex: true, repairEnding: true });

    expect(
      findElement(getFirstBlockTree(math.state), (element) => {
        return element.properties?.dataType === 'inline-math';
      }),
    ).toBeUndefined();

    math.pluginConfigs.next(
      asRuntimePluginConfigs({
        [SyntaxMathRemarkPlugin.key]: { repairEnding: false },
      }),
    );
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

    ending.remarks.next([]);
    ending.rehypes.next([]);
    // Simulate untyped JavaScript input to verify system fields still win at runtime.
    ending.pluginConfigs.next({
      [ApplyRepairsRemarkPlugin.key]: {
        plugins: [],
        ending: false,
      },
    } as unknown as TestPluginConfigs);
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

    harness.repairs.next([EndingMarkerRepairPlugin]);
    harness.pluginConfigs.next({
      [EndingMarkerRepairPlugin.key]: { marker: '|configured' },
    });

    expect(collectText(getFirstBlockTree(harness.state))).toBe('base|configured');
    expect(EndingMarkerRepairPlugin.destroyed).toHaveBeenCalledTimes(2);
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
      harness.pluginConfigs,
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
    expect(harness.pluginConfigs.closed).toBe(false);
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
    const initialConfigObservers = getObserverCount(harness.pluginConfigs);

    expect(initialRemarkObservers).toBe(3);

    harness.text.next('first');

    expect(harness.state.value.value).toHaveLength(1);
    expect(getObserverCount(harness.remarks)).toBe(initialRemarkObservers - 2);
    expect(getObserverCount(harness.pluginConfigs)).toBe(initialConfigObservers - 4);
    expect(AppendRemarkPlugin.destroyed).toHaveBeenCalledTimes(2);

    harness.text.next('first\n\nfourth');

    expect(harness.state.value.value).toHaveLength(2);
    expect(getObserverCount(harness.remarks)).toBe(initialRemarkObservers - 1);
    expect(getObserverCount(harness.pluginConfigs)).toBe(initialConfigObservers - 2);
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
