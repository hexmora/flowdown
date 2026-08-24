import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { CodeHeaderRenderer } from '../plugins/slot/code-header/renderer';
import { CodeHeaderInnerActionKey } from '../types';

describe('CodeHeaderRenderer', () => {
  test('keeps the default copy action when a consumer extends actions', () => {
    const onCopy = vi.fn();
    const extendActions = vi.fn((previous) => [
      ...previous,
      { key: 'inspect', target: <button type="button">Inspect</button> },
    ]);

    render(
      <CodeHeaderRenderer
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

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

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
        actions={[{ key: 'extra', target: <span>Extra action</span> }]}
        code="value"
      />,
    );

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByText('Extra action')).toBeInTheDocument();
  });
});
