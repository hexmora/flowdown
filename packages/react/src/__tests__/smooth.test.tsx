import { act, cleanup, render } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { FlowdownRef } from '../types';

import { Flowdown } from '..';
import { createRafClock } from './utils/raf';
import { createManualTicker, createStepScheduler } from './utils/smooth';

afterEach(async () => {
  cleanup();

  await act(async () => {});

  vi.restoreAllMocks();

  vi.unstubAllGlobals();
});

describe('Flowdown smooth streaming', () => {
  test('renders immediately by default and when an options object omits enabled', () => {
    const clock = createRafClock();

    const view = render(<Flowdown text="" />);

    view.rerender(<Flowdown text="default stream" />);

    expect(view.container).toHaveTextContent('default stream');

    view.rerender(
      <Flowdown smooth={{ scheduler: 'spring', ticker: 'raf' }} text="object stream" />,
    );

    expect(view.container).toHaveTextContent('object stream');

    expect(clock.request).not.toHaveBeenCalled();
  });

  test('shows initial content immediately and reveals an appended suffix across frames', async () => {
    const clock = createRafClock();

    const view = render(<Flowdown smooth text="abc" />);

    expect(view.container).toHaveTextContent('abc');

    view.rerender(<Flowdown smooth text="abcdef" />);

    expect(view.container.textContent).toBe('abc');

    await clock.advanceUntil(() => view.container.textContent === 'abcdef');

    expect(clock.request).toHaveBeenCalled();
  });

  test('enables smoothing dynamically, flushes on disable, and resumes from visible content', async () => {
    const clock = createRafClock();

    const ref = createRef<FlowdownRef>();

    const view = render(<Flowdown ref={ref} text="abc" />);

    const closure = ref.current;

    view.rerender(<Flowdown ref={ref} smooth text="abc" />);

    view.rerender(<Flowdown ref={ref} smooth text="abcdef" />);

    expect(view.container.textContent).toBe('abc');

    view.rerender(<Flowdown ref={ref} smooth={false} text="abcdef" />);

    expect(view.container.textContent).toBe('abcdef');

    expect(clock.pending.size).toBe(0);

    view.rerender(<Flowdown ref={ref} smooth text="abcdef" />);

    view.rerender(<Flowdown ref={ref} smooth text="abcdefghi" />);

    expect(view.container.textContent).toBe('abcdef');

    await clock.advanceUntil(() => view.container.textContent === 'abcdefghi');

    expect(ref.current).toBe(closure);
  });

  test('reveals compiled emphasis without displaying Markdown delimiters', async () => {
    const clock = createRafClock();

    const view = render(<Flowdown smooth text="" />);

    view.rerender(<Flowdown smooth text="**alphabet**" />);

    expect(view.container.textContent).toBe('');

    await clock.advanceUntil(() => (view.container.textContent?.length ?? 0) > 0);

    expect(view.container.querySelector('strong')).not.toBeNull();

    expect(view.container.textContent).not.toContain('*');

    await clock.advanceUntil(() => view.container.textContent === 'alphabet');

    expect(view.container.querySelector('strong')).toHaveTextContent('alphabet');

    expect(view.container.textContent).not.toContain('*');
  });

  test('keeps completed blocks and the growing paragraph mounted across ticks', async () => {
    const clock = createRafClock();

    const view = render(<Flowdown smooth text="first" />);

    const firstParagraph = view.container.querySelector('p');

    view.rerender(<Flowdown smooth text={'first\n\nsecond'} />);

    expect(view.container.textContent).toBe('first');

    await clock.advanceUntil(() => view.container.querySelectorAll('p').length === 2);

    const growingParagraph = view.container.querySelectorAll('p').item(1);

    await clock.advanceUntil(() => view.container.textContent === 'firstsecond');

    expect(view.container.querySelector('p')).toBe(firstParagraph);

    expect(view.container.querySelectorAll('p').item(1)).toBe(growingParagraph);

    view.rerender(<Flowdown smooth text={'first\n\nsecond plus'} />);

    expect(view.container.textContent).toBe('firstsecond');

    await clock.advanceUntil(() => view.container.textContent === 'firstsecond plus');

    expect(view.container.querySelector('p')).toBe(firstParagraph);

    expect(view.container.querySelectorAll('p').item(1)).toBe(growingParagraph);
  });

  test('cancels pending animation work and closes the committed core on unmount', async () => {
    const clock = createRafClock();

    const ref = createRef<FlowdownRef>();

    const view = render(<Flowdown ref={ref} smooth text="first" />);

    const closure = ref.current;

    view.rerender(<Flowdown ref={ref} smooth text="first with a pending suffix" />);

    expect(clock.pending.size).toBeGreaterThan(0);

    view.unmount();

    await act(async () => {});

    expect(clock.pending.size).toBe(0);

    expect(clock.cancel).toHaveBeenCalled();

    expect(closure?.value.closed).toBe(true);

    await clock.step();

    expect(clock.pending.size).toBe(0);
  });

  test('survives StrictMode replay and leaves no animation work after final unmount', async () => {
    const clock = createRafClock();

    const ref = createRef<FlowdownRef>();

    const view = render(
      <StrictMode>
        <Flowdown ref={ref} smooth text="first" />
      </StrictMode>,
    );

    const closure = ref.current;

    view.rerender(
      <StrictMode>
        <Flowdown ref={ref} smooth text="first second" />
      </StrictMode>,
    );

    expect(view.container.textContent).toBe('first');

    await clock.advanceUntil(() => view.container.textContent === 'first second');

    expect(ref.current).toBe(closure);

    view.unmount();

    await act(async () => {});

    expect(clock.pending.size).toBe(0);

    expect(closure?.value.closed).toBe(true);
  });

  test('applies build changes to existing text while smoothing is enabled', async () => {
    const clock = createRafClock();

    const view = render(<Flowdown build={{ tex: false }} smooth text="$x$" />);

    expect(view.container.textContent).toBe('$x$');

    view.rerender(<Flowdown build={{ tex: true }} smooth text="$x$" />);

    await clock.advanceUntil(() => view.container.textContent === 'x');

    view.rerender(<Flowdown build={{ tex: false }} smooth={false} text="$x$" />);

    expect(view.container.textContent).toBe('$x$');
  });

  test('switches custom tickers without losing visible progress and releases the old ticker', async () => {
    const first = createManualTicker();

    const second = createManualTicker();

    const Scheduler = createStepScheduler(1);

    const options = (ticker: typeof first.Ticker) => ({
      enabled: true,
      ticker,
      scheduler: Scheduler,
    });

    const view = render(<Flowdown smooth={options(first.Ticker)} text="abc" />);

    view.rerender(<Flowdown smooth={options(first.Ticker)} text="abcdef" />);

    await act(async () => first.current().tick(16));

    expect(view.container.textContent).toBe('abcd');

    view.rerender(<Flowdown smooth={options(second.Ticker)} text="abcdef" />);

    expect(view.container.textContent).toBe('abcd');

    expect(first.current().running).toBe(false);

    expect(first.current().destroyCalls).toBe(1);

    await act(async () => first.current().tick(32));

    expect(view.container.textContent).toBe('abcd');

    await act(async () => second.current().tick(32));

    expect(view.container.textContent).toBe('abcde');

    view.unmount();

    await act(async () => {});

    expect(second.current().running).toBe(false);

    expect(second.current().destroyCalls).toBe(1);
  });

  test('applies a changed custom scheduler to the remaining suffix', async () => {
    const ticker = createManualTicker();

    const SlowScheduler = createStepScheduler(1);

    const FastScheduler = createStepScheduler(2);

    const options = (scheduler: typeof SlowScheduler) => ({
      enabled: true,
      ticker: ticker.Ticker,
      scheduler,
    });

    const view = render(<Flowdown smooth={options(SlowScheduler)} text="abc" />);

    view.rerender(<Flowdown smooth={options(SlowScheduler)} text="abcdefgh" />);

    await act(async () => ticker.current().tick(16));

    expect(view.container.textContent).toBe('abcd');

    view.rerender(<Flowdown smooth={options(FastScheduler)} text="abcdefgh" />);

    expect(view.container.textContent).toBe('abcd');

    await act(async () => ticker.current().tick(32));

    expect(view.container.textContent).toBe('abcdef');

    await act(async () => ticker.current().tick(48));

    expect(view.container.textContent).toBe('abcdefgh');
  });

  test('renders full server markup with smoothing enabled and starts no timers', () => {
    const request = vi.fn();

    const interval = vi.fn();

    vi.stubGlobal('document', undefined);

    vi.stubGlobal('requestAnimationFrame', request);

    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    vi.stubGlobal('setInterval', interval);

    try {
      const markup = renderToStaticMarkup(<Flowdown smooth text="# Smooth server heading" />);

      expect(markup).toMatch(/<h1\b[^>]*>Smooth server heading<\/h1>/);

      expect(request).not.toHaveBeenCalled();

      expect(interval).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
