import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { CodeHeaderRenderer } from '../plugins/slot/code-header/renderer';
import { COPY_FEEDBACK_MS } from '../plugins/slot/code-header/renderer/consts';
import { CodeHeaderInnerActionKey } from '../types';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
const writeText = vi.fn<(text: string) => Promise<void>>();
const execCommand = vi.fn<(command: string) => boolean>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset().mockResolvedValue(undefined);
  execCommand.mockReset().mockReturnValue(false);

  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();

  if (clipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }

  if (execCommandDescriptor) {
    Object.defineProperty(document, 'execCommand', execCommandDescriptor);
  } else {
    Reflect.deleteProperty(document, 'execCommand');
  }
});

describe('CodeHeaderRenderer', () => {
  test('keeps the default copy action and notifies after copying when a consumer extends actions', async () => {
    const onCopy = vi.fn();
    const extendActions = vi.fn((previous) => [
      ...previous,
      { key: 'inspect', target: <button type="button">Inspect</button> },
    ]);

    render(
      <CodeHeaderRenderer
        Raw={null}
        actions={extendActions}
        code="const answer = 42;"
        language="ts"
        meta="title=answer"
        onCopy={onCopy}
      />,
    );

    expect(extendActions).toHaveBeenCalledOnce();
    expect(extendActions.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ key: CodeHeaderInnerActionKey.Copy }),
    ]);
    expect(screen.getByRole('button', { name: 'Inspect' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(writeText).toHaveBeenCalledWith('const answer = 42;');
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onCopy).toHaveBeenCalledWith({
      code: 'const answer = 42;',
      language: 'ts',
      meta: 'title=answer',
    });
  });

  test('appends an actions array after the built-in copy action', () => {
    render(
      <CodeHeaderRenderer
        Raw={null}
        actions={[{ key: 'extra', target: <span>Extra action</span> }]}
        code="value"
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByText('Extra action')).toBeInTheDocument();
  });

  test('shows a checkmark only after success and restores the copy icon after the feedback delay', async () => {
    let resolveCopy: (() => void) | undefined;

    writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );

    render(<CodeHeaderRenderer Raw={null} code="copied source" />);

    const button = screen.getByRole('button', { name: 'Copy' });

    expect(button.querySelector('rect')).not.toBeNull();
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();

    await act(async () => resolveCopy?.());

    const copiedButton = screen.getByRole('button', { name: 'Copied' });

    expect(copiedButton.querySelector('rect')).toBeNull();
    expect(copiedButton.querySelector('path')).toHaveAttribute('d', 'm5 12 4 4L19 6');
    fireEvent.click(copiedButton);
    expect(writeText).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS));

    expect(screen.getByRole('button', { name: 'Copy' }).querySelector('rect')).not.toBeNull();
  });

  test('uses a selected-text fallback when Clipboard API access is denied', async () => {
    writeText.mockRejectedValue(new Error('Denied'));
    execCommand.mockImplementation((command) => {
      const textarea = document.querySelector('textarea');

      expect(command).toBe('copy');
      expect(textarea?.value).toBe('line one\nline two');
      expect(textarea?.selectionStart).toBe(0);
      expect(textarea?.selectionEnd).toBe('line one\nline two'.length);
      return true;
    });

    const onCopy = vi.fn();

    render(<CodeHeaderRenderer Raw={null} code={'line one\nline two'} onCopy={onCopy} />);

    const button = screen.getByRole('button', { name: 'Copy' });

    button.focus();

    await act(async () => fireEvent.click(button));

    expect(execCommand).toHaveBeenCalledOnce();
    expect(document.querySelector('textarea')).toBeNull();
    expect(button).toHaveFocus();
    expect(onCopy).toHaveBeenCalledWith({
      code: 'line one\nline two',
      language: undefined,
      meta: undefined,
    });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  test('falls back when the Clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    execCommand.mockReturnValue(true);

    render(<CodeHeaderRenderer Raw={null} code="plain text" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  test('does not report success or notify when both clipboard methods fail', async () => {
    writeText.mockRejectedValue(new Error('Denied'));
    execCommand.mockReturnValue(false);

    const onCopy = vi.fn();

    render(<CodeHeaderRenderer Raw={null} code="retry this" onCopy={onCopy} />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));

    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
    expect(onCopy).not.toHaveBeenCalled();

    writeText.mockResolvedValue(undefined);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));

    expect(onCopy).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  test('cleans up fallback selection when the legacy copy command throws', async () => {
    writeText.mockRejectedValue(new Error('Denied'));
    execCommand.mockImplementation(() => {
      throw new Error('Legacy copy unavailable');
    });

    render(<CodeHeaderRenderer Raw={null} code="not copied" />);

    const button = screen.getByRole('button', { name: 'Copy' });

    button.focus();

    await act(async () => fireEvent.click(button));

    expect(document.querySelector('textarea')).toBeNull();
    expect(button).toHaveFocus();
    expect(button).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull();
  });

  test('clears feedback timers on unmount and ignores late clipboard results', async () => {
    const { unmount } = render(<CodeHeaderRenderer Raw={null} code="completed" />);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    let resolveCopy: (() => void) | undefined;
    const onCopy = vi.fn();

    writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        }),
    );

    const pending = render(<CodeHeaderRenderer Raw={null} code="pending" onCopy={onCopy} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    pending.unmount();

    await act(async () => resolveCopy?.());

    expect(onCopy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('resets copy feedback when code changes and preserves DOM attributes', async () => {
    const { container, rerender } = render(
      <CodeHeaderRenderer
        Raw={null}
        code="before"
        data-example="header"
        aria-label="Code header"
      />,
    );

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));
    rerender(
      <CodeHeaderRenderer Raw={null} code="after" data-example="header" aria-label="Code header" />,
    );

    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    expect(container.firstElementChild).toHaveAttribute('data-example', 'header');
    expect(container.firstElementChild).toHaveAttribute('aria-label', 'Code header');
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })));

    expect(writeText).toHaveBeenLastCalledWith('after');
  });
});
