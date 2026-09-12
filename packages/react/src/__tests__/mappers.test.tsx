import type { MapperInputs, MapperPluggable } from '@fluxdown/core';

import { act, cleanup, render, waitFor } from '@testing-library/react';
import {
  type IReadableClosure,
  MutableState,
  once,
  useClearable,
  useCombineMap,
  useDefaults,
  useMap,
} from 'functive';
import { first, reverse } from 'lodash-es';
import { createRef, StrictMode } from 'react';

import type { FluxdownRef, IPluginItem } from '../types';

import { Fluxdown } from '..';
import { createManualTicker, createStepScheduler } from './utils/smooth';

const Reverse = once(({ source }: MapperInputs) =>
  useMap(source, (blocks) => reverse([...blocks])),
);

const Limit = once(({ source, count }: MapperInputs & { count: number }) =>
  useMap(source, (blocks) => blocks.slice(0, count)),
);

afterEach(async () => {
  cleanup();

  await act(async () => {});

  jest.restoreAllMocks();
});

describe('Fluxdown mapper plugins', () => {
  test('applies keyed pack config and rebinds distinct readable config values', async () => {
    const state = MutableState.of(1);

    const destroy = jest.fn();

    const left = { value: state, destroy };

    const right = { value: state, destroy };

    const received = jest.fn();

    const Configured = Object.assign(
      once(({ source, count }: MapperInputs & { count?: IReadableClosure<number> }) => {
        received(count);

        const limit = useDefaults(count, 1);

        return useCombineMap([source, limit], ([blocks, size]) => blocks.slice(0, size));
      }),
      { key: 'configured-mapper' },
    );

    const content = (count: IReadableClosure<number>) => (
      <Fluxdown
        text={'first\n\nsecond'}
        plugins={[{ config: { [Configured.key]: { count } }, mappers: [Configured] }]}
      />
    );

    const view = render(content(left));

    expect(view.container.textContent).toBe('first');

    expect(received).toHaveBeenLastCalledWith(left);

    view.rerender(content(right));

    await waitFor(() => expect(received).toHaveBeenLastCalledWith(right));

    act(() => state.next(2));

    expect(view.container.textContent).toBe('firstsecond');

    view.unmount();

    await act(async () => {});

    state.destroy();
  });

  test('updates tuple config, pack order, and mapper membership without replacing Core', async () => {
    const ref = createRef<FluxdownRef>();

    const packs = (count: number): IPluginItem[] => [
      { mappers: [Reverse] },
      { mappers: [[Limit, { count }]] },
    ];

    const view = render(
      <Fluxdown ref={ref} text={'first\n\nsecond\n\nthird'} plugins={packs(1)} />,
    );

    const core = ref.current;

    expect(view.container.textContent).toBe('third');

    view.rerender(<Fluxdown ref={ref} text={'first\n\nsecond\n\nthird'} plugins={packs(2)} />);

    await waitFor(() => expect(view.container.textContent).toBe('thirdsecond'));

    view.rerender(
      <Fluxdown ref={ref} text={'first\n\nsecond\n\nthird'} plugins={reverse(packs(2))} />,
    );

    await waitFor(() => expect(view.container.textContent).toBe('secondfirst'));

    view.rerender(<Fluxdown ref={ref} text={'first\n\nsecond\n\nthird'} plugins={[]} />);

    await waitFor(() => expect(view.container.textContent).toBe('firstsecondthird'));

    expect(ref.current).toBe(core);
  });

  test('reuses and releases dynamically added mappers through StrictMode updates', async () => {
    const created = jest.fn();

    const destroyed = jest.fn();

    const Tracked = once(({ source, count }: MapperInputs & { count: number }) => {
      created(count);

      useClearable(() => destroyed(count));

      return useMap(source, (blocks) => blocks.slice(0, count));
    });

    const content = (count: number) => (
      <StrictMode>
        <Fluxdown text={'first\n\nsecond'} plugins={[{ mappers: [[Tracked, { count }]] }]} />
      </StrictMode>
    );

    const view = render(
      <StrictMode>
        <Fluxdown text={'first\n\nsecond'} />
      </StrictMode>,
    );

    view.rerender(content(1));

    await act(async () => {});

    const activeCount = created.mock.calls.length - destroyed.mock.calls.length;

    const initialCreates = created.mock.calls.length;

    expect(activeCount).toBe(1);

    view.rerender(content(1));

    expect(created).toHaveBeenCalledTimes(initialCreates);

    view.rerender(content(2));

    await waitFor(() => expect(view.container.textContent).toBe('firstsecond'));

    expect(created.mock.calls.length - destroyed.mock.calls.length).toBe(1);

    view.rerender(
      <StrictMode>
        <Fluxdown text="removed" />
      </StrictMode>,
    );

    await waitFor(() => expect(destroyed).toHaveBeenCalledTimes(created.mock.calls.length));

    view.rerender(content(1));

    view.unmount();

    await waitFor(() => expect(destroyed).toHaveBeenCalledTimes(created.mock.calls.length));
  });

  test('keeps Smooth progress and ticker when appending or removing a mapper', async () => {
    const ticker = createManualTicker();

    const scheduler = createStepScheduler(1);

    const smooth = { enabled: true, ticker: ticker.Ticker, scheduler };

    const renderContent = (text: string, mappers: MapperPluggable[] = []) => (
      <Fluxdown smooth={smooth} text={text} plugins={[{ mappers }]} />
    );

    const view = render(renderContent('a'));

    view.rerender(renderContent('abcd'));

    act(() => ticker.current().tick(16));

    expect(view.container.textContent).toBe('ab');

    const original = ticker.current();

    view.rerender(renderContent('abcd', [Reverse]));

    await waitFor(() => expect(view.container.textContent).toBe('ab'));

    act(() => ticker.current().tick(32));

    expect(view.container.textContent).toBe('abc');

    view.rerender(renderContent('abcd'));

    act(() => ticker.current().tick(48));

    expect(view.container.textContent).toBe('abcd');

    expect(ticker.instances).toHaveLength(1);

    expect(first(ticker.instances)).toBe(original);

    view.unmount();

    await waitFor(() => expect(original.destroyCalls).toBe(1));
  });
});
