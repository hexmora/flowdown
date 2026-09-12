import type { IRenderPatchItem } from '@fluxdown/core';
import type { IReactRenderPlugin } from '@fluxdown/react-presets/base';
import type { Root } from 'hast';
import type { ReactNode } from 'react';

import { BlockItem } from '@fluxdown/core';
import { PatchRenderPlugin } from '@fluxdown/react-presets/render';
import { act, render, screen } from '@testing-library/react';
import { MutableState, toClosure } from 'functive';

import { BlockReconciler } from '..';

const createBlock = () =>
  new BlockItem({
    source: toClosure<Root>({ type: 'root', children: [{ type: 'text', value: 'body' }] }),
    meta: toClosure({
      key: '1',
      sourceText: 'body',
      charStart: 0,
      charEnd: 4,
      currentIndex: 0,
      blockCount: 1,
    }),
  });

const createPatches = (label: string): IRenderPatchItem<ReactNode>[] => [
  {
    key: 'selected',
    render: (text) => (
      <output>
        {label}:{text}
      </output>
    ),
  },
];

const patchPlugin = new PatchRenderPlugin();

const createPlugin = (label: string): IReactRenderPlugin => ({
  config: {},
  destroy: jest.fn(),
  match: () => true,
  render: (params) =>
    patchPlugin.render({
      ...params,
      node: {
        type: 'element',
        tagName: 'span',
        properties: { dataParserPatch: '1', dataPatchKey: 'selected', dataPatchText: label },
        children: [],
      },
    }),
});

describe('BlockReconciler', () => {
  test('accepts plain patch and plugin arrays and follows replacement props', () => {
    const block = createBlock();
    const view = render(
      <BlockReconciler
        block={block}
        patches={createPatches('first')}
        plugins={[createPlugin('plain')]}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('first:plain');

    view.rerender(
      <BlockReconciler
        block={block}
        patches={createPatches('next')}
        plugins={[createPlugin('updated')]}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('next:updated');

    view.unmount();
    block.destroy();
  });

  test('subscribes to reactive sources without taking ownership of them', () => {
    const block = createBlock();
    const patches = MutableState.of(createPatches('first'));
    const plugins = MutableState.of([createPlugin('state')]);
    const patchSubscribe = jest.spyOn(patches, 'subscribe');
    const pluginSubscribe = jest.spyOn(plugins, 'subscribe');
    const view = render(<BlockReconciler block={block} patches={patches} plugins={plugins} />);

    act(() => {
      patches.next(createPatches('next'));
      plugins.next([createPlugin('updated')]);
    });

    expect(screen.getByRole('status')).toHaveTextContent('next:updated');

    view.unmount();

    expect(patchSubscribe).toHaveBeenCalled();
    expect(pluginSubscribe).toHaveBeenCalled();
    expect(
      patchSubscribe.mock.results.every(
        (result) => result.type === 'return' && result.value.closed,
      ),
    ).toBe(true);
    expect(
      pluginSubscribe.mock.results.every(
        (result) => result.type === 'return' && result.value.closed,
      ),
    ).toBe(true);
    expect(patches.closed).toBe(false);
    expect(plugins.closed).toBe(false);

    block.destroy();
    patches.complete();
    plugins.complete();
  });

  test('reads borrowed closures without destroying them when unmounted', () => {
    const block = createBlock();
    const patchSource = MutableState.of(createPatches('first'));
    const pluginSource = MutableState.of([createPlugin('closure')]);
    const patchSubscribe = jest.spyOn(patchSource, 'subscribe');
    const pluginSubscribe = jest.spyOn(pluginSource, 'subscribe');
    const patches = toClosure(patchSource);
    const plugins = toClosure(pluginSource);
    const view = render(<BlockReconciler block={block} patches={patches} plugins={plugins} />);

    act(() => {
      patchSource.next(createPatches('next'));
    });

    expect(screen.getByRole('status')).toHaveTextContent('next:closure');

    view.unmount();

    expect(patches.value.closed).toBe(false);
    expect(plugins.value.closed).toBe(false);

    patches.destroy();
    plugins.destroy();

    expect(
      patchSubscribe.mock.results.every(
        (result) => result.type === 'return' && result.value.closed,
      ),
    ).toBe(true);
    expect(
      pluginSubscribe.mock.results.every(
        (result) => result.type === 'return' && result.value.closed,
      ),
    ).toBe(true);

    block.destroy();
    patchSource.complete();
    pluginSource.complete();
  });
});
