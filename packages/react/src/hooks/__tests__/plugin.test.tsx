import { renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { IPluginItem } from '../../types';

import { usePlugins } from '..';

type RemarkItem = NonNullable<IPluginItem['remarks']>[number];

type RenderItem = NonNullable<IPluginItem['renders']>[number];

interface PluginOrderProps {
  defaults: RemarkItem[];

  packs: IPluginItem[];
}

const asRemark = (name: string) => ({ name }) as unknown as RemarkItem;

const asRender = (name: string) => ({ name }) as unknown as RenderItem;

const createPluginClass = (key: string) => {
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

  test('keeps explicit tuple options instead of replacing them with pack config', () => {
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

    expect(result.current).toEqual([tuple]);

    expect(result.current[0]).toBe(tuple);
  });

  test.each(['remarks', 'rehypes', 'repairs', 'renders', 'slots'] as const)(
    'supports the %s plugin channel',
    (type) => {
      const plugin = { type } as never;

      const packs = [{ [type]: [plugin] }] as IPluginItem[];

      const { result } = renderHook(() => usePlugins(packs, type));

      expect(result.current).toEqual([plugin]);
    },
  );
});
