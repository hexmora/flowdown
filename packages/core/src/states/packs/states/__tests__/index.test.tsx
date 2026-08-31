/** @jsxImportSource @flowdown/reactive */

import type {
  IPluggable,
  IPluginWithConfig,
  IRawPatchItem,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
} from '@flowdown/types';

import {
  ApplyRepairsRemarkPlugin,
  DanglingFootnoteRepairPlugin,
  HoistFootnoteRehypePlugin,
  SyntaxMathRemarkPlugin,
} from '@flowdown/preset-plugins';
import {
  buildDescriptor,
  type IReactiveState,
  type IStateClosure,
  type JSXDescriptor,
  MutableState,
  S,
} from '@flowdown/reactive';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';

import type { IRenderPatchItem } from '../../../../externals/base-renderer';
import type { BlockCompilerConfig, BlockRemarksConfig } from '../../../hast/block-compiler';
import type { IPatchItem } from '../../type';

import {
  RawPatchesMapper,
  RehypePluggablesMapper,
  RemarkPluggablesMapper,
  RenderPatchesMapper,
  RepairPluggablesMapper,
} from '..';

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
  test('maps raw and render patches independently', () => {
    const renderFirst = vi.fn(() => 'first');

    const renderSecond = vi.fn(() => 'second');

    const patches = MutableState.of<IPatchItem<string>[]>([
      { key: 'stable', range: [1, 2], render: renderFirst },
    ]);

    const rawPatches = buildDescriptor<IRawPatchItem[]>(
      S<IRawPatchItem[]>(<RawPatchesMapper<string> patches={patches} />),
    );

    const renderPatches = buildDescriptor<IRenderPatchItem<string>[]>(
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

    const rehypeExtras = MutableState.of<IPluggable<IRehypePlugin, unknown>[]>([]);

    const remarkExtras = MutableState.of<IPluggable<IRemarkPlugin, unknown>[]>([]);

    const repairExtras = MutableState.of<IPluggable<IRepairPlugin, unknown>[]>([]);

    const repairs = MutableState.of<IRepairPlugin[]>([]);

    const rehypes = buildDescriptor<IPluggable<IRehypePlugin, unknown>[]>(
      S<IPluggable<IRehypePlugin, unknown>[]>(
        <RehypePluggablesMapper config={config} extras={rehypeExtras} />,
      ),
    );

    const remarks = buildDescriptor<IPluggable<IRemarkPlugin, unknown>[]>(
      S<IPluggable<IRemarkPlugin, unknown>[]>(
        <RemarkPluggablesMapper config={remarksConfig} extras={remarkExtras} repairs={repairs} />,
      ),
    );

    const repairPluggables = buildDescriptor<IPluggable<IRepairPlugin, unknown>[]>(
      S<IPluggable<IRepairPlugin, unknown>[]>(
        <RepairPluggablesMapper config={config} extras={repairExtras} />,
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

  expectTypeOf(buildDescriptor(rawPatches)).toEqualTypeOf<IStateClosure<IRawPatchItem[]>>();

  // @ts-expect-error Explicit mapper generics remain part of the patches contract.
  <RawPatchesMapper<string> patches={MutableState.of<IPatchItem<number>[]>([])} />;
};

void typecheckPackStateMappers;
