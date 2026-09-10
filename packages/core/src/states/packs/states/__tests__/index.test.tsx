/** @jsxImportSource reactive */

import type {
  IPluggable,
  IPluginWithConfig,
  IRawPatchItem,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
  PluginSet,
} from '@flowdown/types';

import { Shad, Smooth } from '@flowdown/core-presets/mapper';
import { HoistFootnoteRehypePlugin } from '@flowdown/core-presets/rehype';
import { ApplyRepairsRemarkPlugin, SyntaxMathRemarkPlugin } from '@flowdown/core-presets/remark';
import { DanglingFootnoteRepairPlugin } from '@flowdown/core-presets/repair';
import {
  type IReactiveState,
  type IReadableClosure,
  type JSXDescriptor,
  MutableState,
  render,
  S,
} from 'reactive';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IPatchItem } from '../..';
import type {
  IRenderPatchItem,
  IRenderPlugin,
  IRenderPluginRenderParams,
} from '../../../../externals';
import type { MapperPluggable } from '../../../base';
import type { BlockCompilerConfig, BlockRemarksConfig } from '../../../hast';

import {
  MapperPluggables,
  RawPatchesMapper,
  RehypePluggables,
  RemarkPluggables,
  RenderPatchesMapper,
  RenderPluggables,
  RepairPluggables,
} from '..';
import { BaseRenderPlugin } from '../../../../externals';

class TextRenderPlugin extends BaseRenderPlugin<string, string, string> {
  static readonly key = 'text';

  match() {
    return true;
  }

  render({ node }: IRenderPluginRenderParams<string, string, string>) {
    return node;
  }
}

const DEFAULT_CONFIG: BlockCompilerConfig = {
  repair: false,
  repairEnding: false,
  footnote: false,
  tex: false,
};

const getPluggableClass = <T extends IPluginWithConfig>(pluggable: IPluggable<T, unknown>) => {
  return Array.isArray(pluggable) ? pluggable[0] : pluggable;
};

describe('pack state mappers', () => {
  test('combines mapper configurations reactively and reuses equivalent outputs', () => {
    const extras = MutableState.of<PluginSet<MapperPluggable, MapperConfigs>>([]);

    const state = render(S([MapperPluggables, { extras }]));

    const initial = state.value.value;

    const next = vi.fn();

    state.value.subscribe(next);

    next.mockClear();

    expect(initial).toEqual([Smooth, Shad]);

    extras.next([Shad]);

    expect(state.value.value).toBe(initial);

    expect(next).not.toHaveBeenCalled();

    const enabled = render(true);

    extras.next([[], { shad: { enabled } }]);

    expect(state.value.value).toEqual([Smooth, [Shad, { enabled }]]);

    expect(next).toHaveBeenCalledOnce();

    state.destroy();

    expect(extras.closed).toBe(false);

    extras.destroy();

    enabled.destroy();
  });

  test('combines render configurations reactively without constructing plugin instances', () => {
    const extras = MutableState.of<
      PluginSet<IPluggable<IRenderPlugin<string, string, string>, unknown>, RenderConfigs>
    >([[TextRenderPlugin, { priority: 1 }]]);

    const state = render(S([RenderPluggables<string, string, string>, { extras }]));

    const initial = state.value.value;

    const next = vi.fn();

    state.value.subscribe(next);

    next.mockClear();

    extras.next([[TextRenderPlugin, { priority: 1 }]]);

    expect(state.value.value).toBe(initial);

    expect(next).not.toHaveBeenCalled();

    extras.next([[TextRenderPlugin, { priority: 2 }]]);

    expect(state.value.value).toEqual([[TextRenderPlugin, { priority: 2 }]]);

    expect(next).toHaveBeenCalledOnce();

    state.destroy();

    expect(extras.closed).toBe(false);

    extras.destroy();
  });

  test.each(['rehype', 'repair'] as const)(
    'preserves equal %s outputs when unrelated configuration changes',
    (mapper) => {
      const config = MutableState.of(DEFAULT_CONFIG);

      const extras = MutableState.of({});

      const state =
        mapper === 'rehype'
          ? render(S([RehypePluggables, { config, extras }]))
          : render(S([RepairPluggables, { config, extras }]));

      const initial = state.value.value;

      const next = vi.fn();

      state.value.subscribe(next);

      next.mockClear();

      config.next({ ...DEFAULT_CONFIG, tex: true });

      expect(state.value.value).toBe(initial);

      expect(next).not.toHaveBeenCalled();

      config.next({ ...DEFAULT_CONFIG, footnote: true, repair: true });

      expect(state.value.value).not.toBe(initial);

      expect(next).toHaveBeenCalledOnce();

      state.destroy();

      config.destroy();

      extras.destroy();
    },
  );

  test('maps raw and render patches independently', () => {
    const renderFirst = vi.fn(() => 'first');

    const renderSecond = vi.fn(() => 'second');

    const patches = MutableState.of<IPatchItem<string>[]>([
      { key: 'stable', range: [1, 2], render: renderFirst },
    ]);

    const rawPatches = render<IRawPatchItem[]>(
      S<IRawPatchItem[]>(<RawPatchesMapper<string> patches={patches} />),
    );

    const renderPatches = render<IRenderPatchItem<string>[]>(
      S<IRenderPatchItem<string>[]>(<RenderPatchesMapper<string> patches={patches} />),
    );

    const initialRawPatches = rawPatches.value.value;

    const initialRenderPatches = renderPatches.value.value;

    patches.next([{ key: 'stable', range: [1, 2], render: renderSecond }]);

    expect(rawPatches.value.value).toBe(initialRawPatches);

    expect(renderPatches.value.value).not.toBe(initialRenderPatches);

    const updatedRenderPatches = renderPatches.value.value;

    patches.next([{ key: 'stable', range: [2, 3], render: renderSecond }]);

    expect(rawPatches.value.value).not.toBe(initialRawPatches);

    expect(renderPatches.value.value).toBe(updatedRenderPatches);

    rawPatches.destroy();

    renderPatches.destroy();

    patches.destroy();
  });

  test('maps plugin configuration through independent child closures', () => {
    const config = MutableState.of(DEFAULT_CONFIG);

    const remarksConfig = MutableState.of<BlockRemarksConfig>({
      ...DEFAULT_CONFIG,
      patches: [],
    });

    const rehypeExtras = MutableState.of<
      PluginSet<IPluggable<IRehypePlugin, unknown>, RehypeConfigs>
    >({});

    const remarkExtras = MutableState.of<
      PluginSet<IPluggable<IRemarkPlugin, unknown>, RemarkConfigs>
    >({});

    const repairExtras = MutableState.of<
      PluginSet<IPluggable<IRepairPlugin, unknown>, RepairConfigs>
    >({});

    const repairs = MutableState.of<IRepairPlugin[]>([]);

    const rehypes = render<IPluggable<IRehypePlugin, unknown>[]>(
      S<IPluggable<IRehypePlugin, unknown>[]>(
        <RehypePluggables config={config} extras={rehypeExtras} />,
      ),
    );

    const remarks = render<IPluggable<IRemarkPlugin, unknown>[]>(
      S<IPluggable<IRemarkPlugin, unknown>[]>(
        <RemarkPluggables config={remarksConfig} extras={remarkExtras} repairs={repairs} />,
      ),
    );

    const repairPluggables = render<IPluggable<IRepairPlugin, unknown>[]>(
      S<IPluggable<IRepairPlugin, unknown>[]>(
        <RepairPluggables config={config} extras={repairExtras} />,
      ),
    );

    expect(rehypes.value.value.map(getPluggableClass)).not.toContain(HoistFootnoteRehypePlugin);

    expect(remarks.value.value.map(getPluggableClass)).not.toContain(SyntaxMathRemarkPlugin);

    expect(remarks.value.value.map(getPluggableClass)).not.toContain(ApplyRepairsRemarkPlugin);

    expect(repairPluggables.value.value).toEqual([]);

    const initialRemarks = remarks.value.value;

    const onRemarks = vi.fn();

    remarks.value.subscribe(onRemarks);

    onRemarks.mockClear();

    remarksConfig.next({ ...DEFAULT_CONFIG, patches: [] });

    expect(remarks.value.value).toBe(initialRemarks);

    expect(onRemarks).not.toHaveBeenCalled();

    config.next({ ...DEFAULT_CONFIG, footnote: true, repair: true });

    remarksConfig.next({
      ...DEFAULT_CONFIG,
      footnote: true,
      patches: [],
      repair: true,
      tex: true,
    });

    expect(rehypes.value.value.map(getPluggableClass)).toContain(HoistFootnoteRehypePlugin);

    expect(remarks.value.value.map(getPluggableClass)).toContain(SyntaxMathRemarkPlugin);

    expect(remarks.value.value.map(getPluggableClass)).toContain(ApplyRepairsRemarkPlugin);

    expect(repairPluggables.value.value.map(getPluggableClass)).toContain(
      DanglingFootnoteRepairPlugin,
    );

    rehypes.destroy();

    remarks.destroy();

    repairPluggables.destroy();

    config.destroy();

    remarksConfig.destroy();

    rehypeExtras.destroy();

    remarkExtras.destroy();

    repairExtras.destroy();

    repairs.destroy();
  });
});

const typecheckPackStateMappers = <R,>(patches: IReactiveState<IPatchItem<R>[]>) => {
  const rawPatches = S<IRawPatchItem[]>(<RawPatchesMapper<R> patches={patches} />);

  const renderPatches = S<IRenderPatchItem<R>[]>(<RenderPatchesMapper<R> patches={patches} />);

  expectTypeOf(rawPatches).toEqualTypeOf<JSXDescriptor<IRawPatchItem[]>>();

  expectTypeOf(renderPatches).toEqualTypeOf<JSXDescriptor<IRenderPatchItem<R>[]>>();

  expectTypeOf(render(rawPatches)).toEqualTypeOf<IReadableClosure<IRawPatchItem[]>>();

  // @ts-expect-error Explicit mapper generics remain part of the patches contract.
  <RawPatchesMapper<string> patches={MutableState.of<IPatchItem<number>[]>([])} />;
};

void typecheckPackStateMappers;

const typecheckRenderPluggables = <E, P, R, C>(
  extras: IReactiveState<PluginSet<IPluggable<IRenderPlugin<E, P, R, C>, unknown>, RenderConfigs>>,
) => {
  const descriptor = S<IPluggable<IRenderPlugin<E, P, R, C>, unknown>[]>(
    <RenderPluggables<E, P, R, C> extras={extras} />,
  );

  expectTypeOf<ReturnType<typeof RenderPluggables<E, P, R, C>>>().toEqualTypeOf<
    IPluggable<IRenderPlugin<E, P, R, C>, unknown>[]
  >();

  expectTypeOf(render(descriptor)).toEqualTypeOf<
    IReadableClosure<IPluggable<IRenderPlugin<E, P, R, C>, unknown>[]>
  >();

  // @ts-expect-error RenderPluggables retains the render plugin output type.
  const mismatched: IReadableClosure<IPluggable<IRenderPlugin<E, P, string, C>, unknown>[]> =
    render(descriptor);

  void mismatched;
};

void typecheckRenderPluggables;
