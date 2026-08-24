import type { IPluggable, IPluginWithConfig } from '@flowdown/types';
import type { ReactNode } from 'react';

import { describe, expect, test } from 'vitest';

import type { FlowdownProps, IPluginItem } from '../../types';

import { isPluggablesEqual, isPropsEqual } from '..';

class TestPlugin implements IPluginWithConfig {
  static readonly key = 'test-plugin';

  readonly config = {};
}

class ReplacementTestPlugin implements IPluginWithConfig {
  static readonly key = 'test-plugin';

  readonly config = {};
}

type TestPluggable = IPluggable<IPluginWithConfig, unknown>;

const plugin = TestPlugin as TestPluggable;

const replacementPlugin = ReplacementTestPlugin as TestPluggable;

const renderPatch = (): ReactNode => null;

describe('comparison utilities', () => {
  test('compares pluggable arrays by class, order, and deep tuple options', () => {
    expect(
      isPluggablesEqual(
        [plugin, [TestPlugin, { nested: { enabled: true } }] as TestPluggable],
        [plugin, [TestPlugin, { nested: { enabled: true } }] as TestPluggable],
      ),
    ).toBe(true);
    expect(
      isPluggablesEqual(
        [[TestPlugin, { nested: { enabled: true } }] as TestPluggable],
        [[TestPlugin, { nested: { enabled: false } }] as TestPluggable],
      ),
    ).toBe(false);
    expect(isPluggablesEqual([plugin], [replacementPlugin])).toBe(false);
    expect(isPluggablesEqual([plugin], [])).toBe(false);
    expect(isPluggablesEqual(Array<TestPluggable>(1), [plugin])).toBe(false);
    expect(isPluggablesEqual([plugin], [[TestPlugin, undefined] as unknown as TestPluggable])).toBe(
      true,
    );
    expect(isPluggablesEqual([plugin, replacementPlugin], [replacementPlugin, plugin])).toBe(false);
  });

  test('compares Flowdown props by their rendered and plugin semantics', () => {
    const remark = [TestPlugin, { nested: { enabled: true } }] as TestPluggable;
    const base: FlowdownProps = {
      className: 'markdown',
      config: {},
      patches: [{ key: 'inline', range: [0, 2], render: renderPatch }],
      plugins: [
        {
          config: { [TestPlugin.key]: { nested: { enabled: true } } },
          remarks: [remark as NonNullable<IPluginItem['remarks']>[number]],
        },
      ],
      style: { color: 'red' },
      text: 'content',
    };
    const equivalent: FlowdownProps = {
      className: 'markdown',
      config: {
        footnote: false,
        repair: false,
        repairEnding: false,
        tex: false,
      },
      patches: [{ key: 'inline', range: [0, 2], render: renderPatch }],
      plugins: [
        {
          config: { [TestPlugin.key]: { nested: { enabled: true } } },
          remarks: [
            [TestPlugin, { nested: { enabled: true } }] as unknown as NonNullable<
              IPluginItem['remarks']
            >[number],
          ],
        },
      ],
      style: { color: 'red' },
      text: 'content',
    };

    expect(isPropsEqual(base, equivalent)).toBe(true);
    expect(isPropsEqual({ ...base, plugins: Array<IPluginItem>(1) }, equivalent)).toBe(false);
    expect(isPropsEqual(base, { ...equivalent, text: 'changed' })).toBe(false);
    expect(isPropsEqual(base, { ...equivalent, className: 'changed' })).toBe(false);
    expect(isPropsEqual(base, { ...equivalent, style: { color: 'blue' } })).toBe(false);
    expect(isPropsEqual(base, { ...equivalent, config: { tex: true } })).toBe(false);
    expect(
      isPropsEqual(base, {
        ...equivalent,
        patches: [{ key: 'inline', range: [0, 2], render: () => null }],
      }),
    ).toBe(false);
    expect(
      isPropsEqual(base, {
        ...equivalent,
        plugins: [
          {
            config: { [TestPlugin.key]: { nested: { enabled: false } } },
            remarks: equivalent.plugins?.[0]?.remarks,
          },
        ],
      }),
    ).toBe(false);
  });
});
