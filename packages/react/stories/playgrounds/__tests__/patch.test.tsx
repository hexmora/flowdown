import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { PatchPlayground } from '../../components/patch-playground';

const matchMark = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'MARK' && element.textContent === text;

const matchMarkPrefix = (prefix: string) => (_: string, element: Element | null) =>
  element?.tagName === 'MARK' && element.textContent?.startsWith(prefix) === true;

describe('Patch playground story', () => {
  test('demonstrates point, replacement, keyless, dynamic, and playback patches together', async () => {
    render(<PatchPlayground />);

    const preview = screen.getByRole('region', { name: 'Preview' });

    expect(within(preview).getByLabelText('Point patch')).toBeInTheDocument();

    const replacementPrefix = 'Replacement: ';

    const replacementBefore = within(preview).getByText(matchMarkPrefix(replacementPrefix));

    const originalText = replacementBefore.textContent?.slice(replacementPrefix.length) ?? '';

    expect(originalText).toMatch(/\S/);

    expect(within(preview).getByText(matchMark('final sentence'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Replace render callback' }));

    await waitFor(() => {
      expect(
        within(preview).queryByText(matchMarkPrefix(replacementPrefix)),
      ).not.toBeInTheDocument();

      expect(
        within(preview).getByText(matchMark(`Updated replacement: ${originalText}`)),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Play' }));

    const playback = screen.getByRole('region', { name: 'Playback preview' });

    const progress = screen.getByRole('slider', { name: 'Progress' });

    expect(within(playback).queryByLabelText('Point patch')).not.toBeInTheDocument();

    fireEvent.change(progress, { target: { value: '100' } });

    await waitFor(() => {
      expect(within(playback).getByLabelText('Point patch')).toBeInTheDocument();

      expect(
        within(playback).getByText(matchMark(`Updated replacement: ${originalText}`)),
      ).toBeInTheDocument();

      expect(within(playback).getByText(matchMark('final sentence'))).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }));

    await waitFor(() => {
      expect(within(playback).queryByLabelText('Point patch')).not.toBeInTheDocument();

      expect(
        within(playback).queryByText(matchMark(`Updated replacement: ${originalText}`)),
      ).not.toBeInTheDocument();

      expect(within(playback).queryByText(matchMark('final sentence'))).not.toBeInTheDocument();
    });
  });
});
