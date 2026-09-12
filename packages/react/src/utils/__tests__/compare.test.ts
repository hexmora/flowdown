import type { IPluggable, IPluginWithConfig, IRemarkPlugin } from '@fluxdown/types';
import type { ReactNode } from 'react';

import { isPluggablesEqual } from '@fluxdown/core';
import { first } from 'lodash-es';

import type { FluxdownProps, IPluginItem } from '../../types';

import { isPropsEqual } from '..';

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
  test('treats omitted plugin lists as empty lists', () => {
    expect(isPluggablesEqual()).toBe(true);

    expect(isPluggablesEqual(undefined, [])).toBe(true);

    expect(isPluggablesEqual([], undefined)).toBe(true);

    expect(isPluggablesEqual(undefined, [plugin])).toBe(false);

    expect(isPluggablesEqual([plugin], undefined)).toBe(false);

    expect(
      isPropsEqual(
        { text: '', plugins: [{}] },
        {
          text: '',
          plugins: [{ remarks: [], rehypes: [], repairs: [], mappers: [], renders: [], slots: [] }],
        },
      ),
    ).toBe(true);
  });

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

  test('compares Fluxdown props by their rendered and plugin semantics', () => {
    const remark = [TestPlugin, { nested: { enabled: true } }] as TestPluggable;
    const base: FluxdownProps = {
      className: 'markdown',
      build: {},
      patches: [{ key: 'inline', range: [0, 2], render: renderPatch }],
      plugins: [
        {
          config: { [TestPlugin.key]: { nested: { enabled: true } } },
          remarks: [remark as IPluggable<IRemarkPlugin, unknown>],
        },
      ],
      style: { color: 'red' },
      text: 'content',
    };
    const equivalent: FluxdownProps = {
      className: 'markdown',
      build: {
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
            [TestPlugin, { nested: { enabled: true } }] as unknown as IPluggable<
              IRemarkPlugin,
              unknown
            >,
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

    expect(isPropsEqual(base, { ...equivalent, build: { tex: true } })).toBe(false);
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
            remarks: first(equivalent.plugins)?.remarks,
          },
        ],
      }),
    ).toBe(false);
  });

  test('compares smoothing enablement and ticker choices', () => {
    const base: FluxdownProps = { text: 'content' };

    const smooth: FluxdownProps = {
      ...base,
      smooth: { enabled: true, ticker: 'raf', scheduler: 'spring' },
    };

    expect(isPropsEqual(base, { ...base, smooth: false })).toBe(true);

    expect(isPropsEqual(base, { ...base, smooth: true })).toBe(false);

    expect(
      isPropsEqual(smooth, {
        ...base,
        smooth: { enabled: true, ticker: 'raf', scheduler: 'spring' },
      }),
    ).toBe(true);

    expect(
      isPropsEqual(smooth, {
        ...base,
        smooth: { enabled: false, ticker: 'raf', scheduler: 'spring' },
      }),
    ).toBe(false);

    expect(
      isPropsEqual(smooth, {
        ...base,
        smooth: { enabled: true, ticker: 'interval', scheduler: 'spring' },
      }),
    ).toBe(false);
  });

  test('short-circuits identical props before reading their values', () => {
    const props = new Proxy<FluxdownProps>(
      { text: 'content' },
      {
        get: () => {
          throw new Error('Prop values must not be read.');
        },
      },
    );

    expect(isPropsEqual(props, props)).toBe(true);
  });
});
