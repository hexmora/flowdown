import { render, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { IPluginItem, IReactRenderPluggable } from '../types';

import { Flowdown } from '..';

interface LifecycleCounts {
  created: number;
  destroyed: number;
}

const createTrackedRenderPlugin = (key: string, counts: LifecycleCounts): IReactRenderPluggable => {
  return class TrackedRenderPlugin {
    static readonly key = key;

    readonly config = {};

    constructor() {
      counts.created += 1;
    }

    match() {
      return false;
    }

    render() {
      return null;
    }

    destroy() {
      counts.destroyed += 1;
    }
  };
};

const createPluginPacks = (renders: IReactRenderPluggable[]): IPluginItem[] => [{ renders }];

describe('render plugin lifecycle', () => {
  test('reuses instances across rebuilt/reordered arrays and retires each instance once', async () => {
    const firstCounts: LifecycleCounts = { created: 0, destroyed: 0 };

    const secondCounts: LifecycleCounts = { created: 0, destroyed: 0 };

    const FirstPlugin = createTrackedRenderPlugin('lifecycle-render-first', firstCounts);

    const SecondPlugin = createTrackedRenderPlugin('lifecycle-render-second', secondCounts);

    const view = render(
      <Flowdown text="lifecycle" plugins={createPluginPacks([FirstPlugin, SecondPlugin])} />,
    );

    await waitFor(() => {
      expect(firstCounts).toEqual({ created: 1, destroyed: 0 });

      expect(secondCounts).toEqual({ created: 1, destroyed: 0 });
    });

    view.rerender(
      <Flowdown text="lifecycle" plugins={createPluginPacks([FirstPlugin, SecondPlugin])} />,
    );

    view.rerender(
      <Flowdown text="lifecycle" plugins={createPluginPacks([SecondPlugin, FirstPlugin])} />,
    );

    expect(firstCounts).toEqual({ created: 1, destroyed: 0 });

    expect(secondCounts).toEqual({ created: 1, destroyed: 0 });

    view.rerender(<Flowdown text="lifecycle" plugins={createPluginPacks([SecondPlugin])} />);

    await waitFor(() => {
      expect(firstCounts).toEqual({ created: 1, destroyed: 1 });

      expect(secondCounts).toEqual({ created: 1, destroyed: 0 });
    });

    view.unmount();

    await waitFor(() => {
      expect(firstCounts).toEqual({ created: 1, destroyed: 1 });

      expect(secondCounts).toEqual({ created: 1, destroyed: 1 });
    });
  });

  test('reuses tuple plugins for semantically equal options and replaces changed options', async () => {
    const counts: LifecycleCounts = { created: 0, destroyed: 0 };

    const receivedOptions: unknown[] = [];

    class ConfiguredRenderPlugin {
      static readonly key = 'lifecycle-render-configured';

      readonly config = {};

      constructor(options: unknown = {}) {
        counts.created += 1;

        receivedOptions.push(options);
      }

      match() {
        return false;
      }

      render() {
        return null;
      }

      destroy() {
        counts.destroyed += 1;
      }
    }

    const configured = (label: string): IReactRenderPluggable => {
      return [ConfiguredRenderPlugin, { label, nested: { enabled: true } }];
    };

    const renderConfigured = (label: string) => (
      <Flowdown text="configured" plugins={[{ renders: [configured(label)] }]} />
    );

    const view = render(renderConfigured('same'));

    await waitFor(() => {
      expect(counts).toEqual({ created: 1, destroyed: 0 });
    });

    view.rerender(renderConfigured('same'));

    expect(counts).toEqual({ created: 1, destroyed: 0 });

    view.rerender(renderConfigured('changed'));

    await waitFor(() => {
      expect(counts).toEqual({ created: 2, destroyed: 1 });

      expect(receivedOptions).toEqual([
        { label: 'same', nested: { enabled: true } },
        { label: 'changed', nested: { enabled: true } },
      ]);
    });

    view.unmount();

    await waitFor(() => {
      expect(counts).toEqual({ created: 2, destroyed: 2 });
    });
  });
});
