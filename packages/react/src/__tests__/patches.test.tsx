import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import type { IPluginItem } from '../types';

import { Flowdown } from '..';

type RemarkPluggable = NonNullable<IPluginItem['remarks']>[number];

const createPatches = (label: string) => [
  {
    key: 'stable-range',
    range: [6, 11] as [number, number],
    render: (text?: string) => (
      <mark data-testid="replacement">
        {label}:{text}
      </mark>
    ),
  },
];

describe('Flowdown patches', () => {
  test('renders point and replacement patches in source order and passes replaced text', () => {
    const { container } = render(
      <Flowdown
        text="Hello world"
        patches={[
          {
            key: 'point',
            range: 5,
            render: (text?: string) => <i data-testid="point">{text ?? '|'}</i>,
          },
          {
            key: 'replacement',
            range: [6, 11],
            render: (text?: string) => <mark data-testid="replacement">{text}</mark>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('point')).toHaveTextContent('|');
    expect(screen.getByTestId('replacement')).toHaveTextContent('world');
    expect(container.firstElementChild).toHaveTextContent('Hello| world');
  });

  test('reacts to patch render changes even when text and patch range stay unchanged', async () => {
    let compileCount = 0;

    class CompileCounterRemarkPlugin {
      static readonly key = 'test-patch-compile-counter';

      readonly config = {};

      readonly plugin = () => () => {
        compileCount += 1;
      };

      destroy() {}
    }

    const plugins: IPluginItem[] = [
      {
        remarks: [CompileCounterRemarkPlugin as unknown as RemarkPluggable],
      },
    ];
    const { rerender } = render(
      <Flowdown text="Hello world" patches={createPatches('first')} plugins={plugins} />,
    );

    expect(screen.getByTestId('replacement')).toHaveTextContent('first:world');

    const initialCompileCount = compileCount;

    rerender(<Flowdown text="Hello world" patches={createPatches('second')} plugins={plugins} />);

    await waitFor(() => {
      expect(screen.getByTestId('replacement')).toHaveTextContent('second:world');
    });

    expect(compileCount).toBe(initialCompileCount);
  });

  test('renders patches without an explicit key', () => {
    render(
      <Flowdown
        text="keyless"
        patches={[
          {
            range: [0, 7],
            render: (text?: string) => <mark data-testid="keyless-patch">{text}</mark>,
          },
        ]}
      />,
    );

    expect(screen.getByTestId('keyless-patch')).toHaveTextContent('keyless');
  });

  test('ignores an out-of-range patch without hiding source content', () => {
    render(
      <Flowdown
        text="visible"
        patches={[
          {
            range: [50, 60],
            render: () => <mark data-testid="out-of-range-patch">hidden</mark>,
          },
        ]}
      />,
    );

    expect(screen.queryByTestId('out-of-range-patch')).not.toBeInTheDocument();
    expect(screen.getByText('visible')).toBeInTheDocument();
  });
});
