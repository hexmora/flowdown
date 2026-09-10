import type { MapperInputs } from '@flowdown/core';
import type { IReactRenderPluggable } from '@flowdown/react-presets/base';
import type { IPluggable, IPluggableConfig, IRemarkPlugin } from '@flowdown/types';

import { SyntaxPolicyRemarkPlugin } from '@flowdown/core-presets/remark';
import { renderHook } from '@testing-library/react';
import { once } from 'reactive';
import { describe, expect, test } from 'vitest';

import type { IPluginItem } from '../../types';

import { usePlugins } from '..';

type RemarkItem = IPluggable<IRemarkPlugin, unknown>;

declare global {
  interface RemarkConfigs {
    'configured-remark'?: IPluggableConfig<{ nested: { enabled: boolean }; suffix: string }>;

    'explicitly-configured-remark'?: IPluggableConfig<{ source: string }>;
  }
}

interface PluginOrderProps {
  defaults: RemarkItem[];

  packs: IPluginItem[];
}

const asRemark = (name: string) => ({ name }) as unknown as RemarkItem;

const asRender = (name: string) => ({ name }) as unknown as IReactRenderPluggable;

const createPluginClass = <const K extends string>(key: K) => {
  return Object.assign(function TestPlugin() {}, { key });
};

describe('usePlugins', () => {
  test('flattens one requested plugin type in pack order and ignores missing fields', () => {
    const first = asRemark('first');

    const second = asRemark('second');

    const unrelated = asRender('unrelated');

    const packs: IPluginItem[] = [
      { remarks: [first], renders: [unrelated] },
      {},
      { remarks: [second] },
    ];

    const { result } = renderHook(() => usePlugins(packs, 'remarks'));

    expect(result.current).toEqual([first, second]);
  });

  test('places the supplied default plugin list before packed plugins', () => {
    const presetA = asRemark('preset-a');

    const presetB = asRemark('preset-b');

    const extraA = asRemark('extra-a');

    const extraB = asRemark('extra-b');

    const packs: IPluginItem[] = [{ remarks: [extraA] }, { remarks: [extraB] }];

    const { result } = renderHook(() => usePlugins(packs, 'remarks', [presetA, presetB]));

    expect(result.current).toEqual([presetA, presetB, extraA, extraB]);
  });

  test('preserves compiler presets before matching configured packed plugins', () => {
    const tuple: RemarkItem = [SyntaxPolicyRemarkPlugin, { indentedCode: false }];

    const packs: IPluginItem[] = [{ remarks: [tuple] }];

    const { result } = renderHook(() => usePlugins(packs, 'remarks', [SyntaxPolicyRemarkPlugin]));

    expect(result.current).toEqual([SyntaxPolicyRemarkPlugin, tuple]);

    expect(result.current[1]).toBe(tuple);
  });

  test('reflects pack and default order changes', () => {
    const presetA = asRemark('preset-a');

    const presetB = asRemark('preset-b');

    const extraA = asRemark('extra-a');

    const extraB = asRemark('extra-b');

    const packA: IPluginItem = { remarks: [extraA] };

    const packB: IPluginItem = { remarks: [extraB] };

    const { result, rerender } = renderHook(
      ({ defaults, packs }: PluginOrderProps) => usePlugins(packs, 'remarks', defaults),
      {
        initialProps: {
          defaults: [presetA, presetB],
          packs: [packA, packB],
        },
      },
    );

    rerender({
      defaults: [presetA, presetB],
      packs: [packB, packA],
    });

    expect(result.current).toEqual([presetA, presetB, extraB, extraA]);

    rerender({
      defaults: [presetB, presetA],
      packs: [packB, packA],
    });

    expect(result.current).toEqual([presetB, presetA, extraB, extraA]);
  });

  test('attaches matching pack config to bare plugin classes without mutating the pack', () => {
    const ConfiguredRemarkPlugin = createPluginClass('configured-remark');

    const plugin = ConfiguredRemarkPlugin as unknown as RemarkItem;

    const options = { nested: { enabled: true }, suffix: '|configured' };

    const pack: IPluginItem = {
      config: { [ConfiguredRemarkPlugin.key]: options },
      remarks: [plugin],
    };

    const originalConfig = pack.config;

    const originalRemarks = pack.remarks;

    const { result } = renderHook(() => usePlugins([pack], 'remarks'));

    expect(result.current).toEqual([[plugin, options]]);

    expect(pack.config).toBe(originalConfig);

    expect(pack.remarks).toBe(originalRemarks);

    expect(pack).toEqual({ config: originalConfig, remarks: originalRemarks });
  });

  test('overrides explicit tuple options with pack config', () => {
    const ConfiguredRemarkPlugin = createPluginClass('explicitly-configured-remark');

    const tuple = [ConfiguredRemarkPlugin, { source: 'tuple' }] as unknown as RemarkItem;

    const { result } = renderHook(() =>
      usePlugins(
        [
          {
            config: { [ConfiguredRemarkPlugin.key]: { source: 'pack' } },
            remarks: [tuple],
          },
        ],
        'remarks',
      ),
    );

    expect(result.current).toEqual([[ConfiguredRemarkPlugin, { source: 'pack' }]]);

    expect(tuple).toEqual([ConfiguredRemarkPlugin, { source: 'tuple' }]);
  });

  test('preserves repeated mapper entries and their tuple fields', () => {
    const Identity = once(function Identity({ source }: MapperInputs) {
      return source;
    });

    const config = { nested: { enabled: true } };

    const pack: IPluginItem = {
      config: { 'remark-syntax-policy': { indentedCode: false } },
      mappers: [Identity, [Identity, config]],
    };

    const { result } = renderHook(() => usePlugins([pack], 'mappers'));

    expect(result.current).toEqual([Identity, [Identity, config]]);

    expect(result.current[0]).toBe(Identity);

    expect(result.current[1]).toBe(pack.mappers?.[1]);
  });

  test.each(['mappers', 'remarks', 'rehypes', 'repairs', 'renders', 'slots'] as const)(
    'preserves default and repeated pack entries in the %s plugin channel',
    (type) => {
      const plugin = { type } as never;

      const other = { type, name: 'other' } as never;

      const packs = [{ [type]: [plugin, other] }, { [type]: [plugin] }] as IPluginItem[];

      const { result } = renderHook(() => usePlugins(packs, type, [plugin]));

      expect(result.current).toEqual([plugin, plugin, other, plugin]);
    },
  );
});
