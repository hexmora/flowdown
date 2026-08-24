import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Playground } from '..';

const CONFIG_LABELS = ['Repair', 'Repair ending', 'Footnote', 'TeX'];

const getPlaybackPreview = () => screen.getByRole('region', { name: 'Playback preview' });

const getProgress = () => screen.getByRole('slider', { name: 'Progress' });

const advancePlayback = async (milliseconds: number) => {
  await act(async () => {
    vi.advanceTimersByTime(milliseconds);

    await Promise.resolve();
  });
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Playground', () => {
  test('offers a non-empty default document and the complete static control surface', async () => {
    render(<Playground />);

    const editor = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Markdown' });

    const preview = screen.getByRole('region', { name: 'Preview' });

    expect(editor.value).toMatch(/\S/);

    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();

    expect(screen.getByRole('button', { name: 'Reset text' })).toBeEnabled();

    expect(screen.getByRole('button', { name: 'Reset settings' })).toBeEnabled();

    for (const label of CONFIG_LABELS) {
      expect(screen.getByRole('checkbox', { name: label })).not.toBeChecked();
    }

    expect(screen.queryByRole('slider', { name: 'Progress' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(preview).not.toBeEmptyDOMElement();
    });
  });

  test('updates the static preview and resets text and settings to their defaults', async () => {
    render(<Playground initialText="Initial document" />);

    const editor = screen.getByRole('textbox', { name: 'Markdown' });

    const preview = screen.getByRole('region', { name: 'Preview' });

    fireEvent.change(editor, { target: { value: 'Edited document' } });

    await waitFor(() => {
      expect(within(preview).getByText('Edited document')).toBeInTheDocument();
    });

    for (const label of CONFIG_LABELS) {
      fireEvent.click(screen.getByRole('checkbox', { name: label }));
    }

    expect(screen.getByRole('checkbox', { name: 'Repair' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));

    for (const label of CONFIG_LABELS) {
      expect(screen.getByRole('checkbox', { name: label })).not.toBeChecked();
    }

    fireEvent.click(screen.getByRole('button', { name: 'Reset text' }));

    expect(editor).toHaveValue('Initial document');

    await waitFor(() => {
      expect(within(preview).getByText('Initial document')).toBeInTheDocument();
    });
  });

  test('reports preview rerenders without replacing the rendered document', async () => {
    render(<Playground initialText="Counted preview" />);

    const preview = screen.getByRole('region', { name: 'Preview' });

    const counter = screen.getByLabelText('Preview render count');

    const getCount = () => Number(counter.textContent?.match(/\d+/)?.[0]);

    const initialCount = getCount();

    expect(initialCount).not.toBeNaN();

    expect(within(preview).getByText('Counted preview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Re-render preview' }));

    await waitFor(() => {
      expect(getCount()).toBeGreaterThan(initialCount);
    });

    expect(within(preview).getByText('Counted preview')).toBeInTheDocument();
  });

  test('plays a text snapshot from zero and supports pause, stepping, scrubbing, and replay', async () => {
    vi.useFakeTimers();

    render(<Playground initialText="1234" />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    const speed = screen.getByRole('slider', { name: 'Speed' });

    const chunkSize = screen.getByRole('slider', { name: 'Chunk size' });

    const progress = getProgress();

    expect(speed).toHaveAttribute('min', '1');

    expect(speed).toHaveAttribute('max', '100');

    expect(chunkSize).toHaveAttribute('min', '1');

    expect(chunkSize).toHaveAttribute('max', '20');

    expect(progress).toHaveAttribute('min', '0');

    expect(progress).toHaveAttribute('max', '100');

    fireEvent.change(speed, { target: { value: '100' } });

    fireEvent.change(chunkSize, { target: { value: '1' } });

    expect(progress).toHaveValue('0');

    expect(within(getPlaybackPreview()).queryByText('1', { exact: true })).not.toBeInTheDocument();

    await advancePlayback(10);

    expect(progress).toHaveValue('25');

    expect(within(getPlaybackPreview()).getByText('1', { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    await advancePlayback(1_000);

    expect(progress).toHaveValue('25');

    expect(within(getPlaybackPreview()).getByText('1', { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Step forward' }));

    expect(progress).toHaveValue('50');

    expect(within(getPlaybackPreview()).getByText('12', { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Step backward' }));

    expect(progress).toHaveValue('25');

    fireEvent.change(progress, { target: { value: '75' } });

    expect(progress).toHaveValue('75');

    expect(within(getPlaybackPreview()).getByText('123', { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    await advancePlayback(10);

    expect(progress).toHaveValue('100');

    expect(within(getPlaybackPreview()).getByText('1234', { exact: true })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^(?:Play|Resume)$/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));

    expect(progress).toHaveValue('0');

    expect(within(getPlaybackPreview()).queryByText('1', { exact: true })).not.toBeInTheDocument();

    await advancePlayback(10);

    expect(progress).toHaveValue('25');

    expect(within(getPlaybackPreview()).getByText('1', { exact: true })).toBeInTheDocument();
  });

  test('keeps the playing snapshot read-only and returns to the edited static document', () => {
    vi.useFakeTimers();

    render(<Playground initialText="Initial" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Markdown' }), {
      target: { value: 'Snapshot' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    const editorWhilePlaying = screen.queryByRole('textbox', { name: 'Markdown' });

    expect(
      editorWhilePlaying === null ||
        editorWhilePlaying.hasAttribute('disabled') ||
        editorWhilePlaying.hasAttribute('readonly'),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Back to editor' }));

    expect(screen.getByRole('textbox', { name: 'Markdown' })).toHaveValue('Snapshot');

    expect(screen.queryByRole('slider', { name: 'Progress' })).not.toBeInTheDocument();
  });

  test('disables empty playback and can start directly in playback mode', () => {
    const empty = render(<Playground initialText="" />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();

    empty.unmount();

    vi.useFakeTimers();

    render(<Playground autoPlay initialText="autoplay" />);

    expect(getProgress()).toHaveValue('0');

    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();

    expect(screen.getByRole('button', { name: 'Back to editor' })).toBeEnabled();
  });

  test('clears playback timers when the playground unmounts', () => {
    vi.useFakeTimers();

    const view = render(<Playground initialText="cleanup" />);

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    view.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
