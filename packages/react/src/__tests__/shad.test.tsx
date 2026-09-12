import { PREFIX } from '@fluxdown/react-presets/base';
import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { FluxdownRef } from '../types';

import styles from '../../../react-presets/src/render/shad/renderer/index.module.scss';
import { Fluxdown } from '../index';
import { createManualTicker, createStepScheduler } from './utils/smooth';

afterEach(async () => {
  cleanup();

  await act(async () => {});

  jest.useRealTimers();
});

describe('Fluxdown shad streaming', () => {
  test('leaves initial content unfaded and hides the mask again after appended text settles', async () => {
    jest.useFakeTimers();

    const view = render(<Fluxdown shad text="abc" />);

    expect(view.container.textContent).toBe('abc');

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('');

    expect(view.container.querySelector(`.${styles.mask}`)).toBeNull();

    view.rerender(<Fluxdown shad text="abcdef" />);

    expect(view.container.textContent).toBe('abcdef');

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('ef');

    expect(view.container.querySelector(`.${styles.mask}`)).toHaveAttribute('aria-hidden', 'true');

    await act(async () => jest.advanceTimersByTime(200));

    expect(view.container.textContent).toBe('abcdef');

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('');

    expect(view.container.querySelector(`.${styles.mask}`)).toBeNull();
  });

  test('supports enablement, tail length, and mask width changes without replacing the core', () => {
    jest.useFakeTimers();

    const ref = createRef<FluxdownRef>();

    const view = render(<Fluxdown ref={ref} text="abc" />);

    const closure = ref.current;

    expect(view.container.querySelector(`.${styles.active}`)).toBeNull();

    view.rerender(<Fluxdown ref={ref} shad={{ length: 2, maskWidth: 24 }} text="abc" />);

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('');

    view.rerender(<Fluxdown ref={ref} shad={{ length: 2, maskWidth: 24 }} text="abcdefgh" />);

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('gh');

    expect(view.container.firstElementChild).toHaveStyle({
      [`--${PREFIX}-shad-mask-width`]: '24px',
    });

    const active = view.container.querySelector(`.${styles.active}`);

    view.rerender(<Fluxdown ref={ref} shad={{ length: 2, maskWidth: 10 }} text="abcdefgh" />);

    expect(view.container.firstElementChild).toHaveStyle({
      [`--${PREFIX}-shad-mask-width`]: '10px',
    });

    expect(view.container.querySelector(`.${styles.active}`)).toBe(active);

    view.rerender(<Fluxdown ref={ref} shad={{ length: 4, maskWidth: 0 }} text="abcdefgh" />);

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('efgh');

    expect(view.container.firstElementChild).toHaveStyle({
      [`--${PREFIX}-shad-mask-width`]: '0px',
    });

    view.rerender(<Fluxdown ref={ref} shad={{ enabled: false }} text="abcdefgh" />);

    expect(view.container.querySelector(`.${styles.active}`)).toBeNull();

    expect(view.container.textContent).toBe('abcdefgh');

    view.rerender(<Fluxdown ref={ref} shad text="abcdefgh" />);

    expect(view.container.querySelector(`.${styles.mask}`)).toBeNull();

    expect(ref.current).toBe(closure);
  });

  test('fades revealed text from smooth ticks while preserving inline markup and completed blocks', async () => {
    jest.useFakeTimers();

    const ticker = createManualTicker();

    const smooth = {
      enabled: true,
      ticker: ticker.Ticker,
      scheduler: createStepScheduler(2),
    };

    const view = render(<Fluxdown shad smooth={smooth} text="first" />);

    const firstParagraph = view.container.querySelector('p');

    view.rerender(<Fluxdown shad smooth={smooth} text={'first\n\n**second**'} />);

    expect(view.container.textContent).toBe('first');

    await act(async () => ticker.current().tick(16));

    expect(view.container.textContent).toBe('firstse');

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('se');

    expect(view.container.querySelector('strong')).toHaveTextContent('se');

    expect(view.container.querySelector('p')).toBe(firstParagraph);

    expect(firstParagraph?.querySelector(`.${styles.active}`)).toBeNull();

    await act(async () => ticker.current().tick(32));

    expect(view.container.textContent).toBe('firstseco');

    expect(view.container.querySelector(`.${styles.active}`)).toHaveTextContent('co');

    await act(async () => ticker.current().tick(48));

    expect(view.container.textContent).toBe('firstsecond');

    await act(async () => jest.advanceTimersByTime(200));

    expect(view.container.querySelector(`.${styles.mask}`)).toBeNull();
  });

  test('renders full server content without an active fade or timers', () => {
    jest.useFakeTimers();

    const timers = jest.getTimerCount();

    const markup = renderToStaticMarkup(<Fluxdown shad smooth text="Server content" />);

    const container = document.createElement('div');

    container.innerHTML = markup;

    expect(container.textContent).toBe('Server content');

    expect(container.querySelector(`.${styles.mask}`)).toBeNull();

    expect(container.querySelector(`.${styles.active}`)).toHaveTextContent('');

    expect(jest.getTimerCount()).toBe(timers);
  });
});
