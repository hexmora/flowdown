import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { HtmlBoundaryLineBreakRepairPlugin } from '../html-boundary-line-break';
import { paragraph, root, runRepairs } from './utils';

describe('HtmlBoundaryLineBreakRepairPlugin', () => {
  test('exposes a matching stable key and always-on config', () => {
    const plugin = new HtmlBoundaryLineBreakRepairPlugin();

    expect(HtmlBoundaryLineBreakRepairPlugin.key).toBe('repair-html-boundary-line-break');
    expect(plugin.config).toMatchObject({ priority: PluginPriority.Default });
    expect(plugin.config.ending).toBeFalsy();
  });

  test.each([
    ['line\n', 'line'],
    ['line\r\n', 'line'],
    ['line\r', 'line'],
  ])('turns one text line ending before HTML into a br element', (value, expected) => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'first\n' },
        { type: 'text', value },
        { type: 'html', value: '<span>html</span>' },
      ]),
    ]);
    const result = runRepairs(tree, new HtmlBoundaryLineBreakRepairPlugin(), {
      ending: false,
    });

    expect(first(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'first\n' },
        { type: 'text', value: expected },
        { type: 'html', value: '<br />' },
        { type: 'html', value: '<span>html</span>' },
      ],
    });
  });

  test('keeps text without a line ending unchanged', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'line' },
        { type: 'html', value: '<span>html</span>' },
      ]),
    ]);

    expect(runRepairs(tree, new HtmlBoundaryLineBreakRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('does not leave an empty text node when the boundary is only a line ending', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: '\n' },
        { type: 'html', value: '<span>html</span>' },
      ]),
    ]);
    const result = runRepairs(tree, new HtmlBoundaryLineBreakRepairPlugin(), {
      ending: false,
    });

    expect(first(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'html', value: '<br />' },
        { type: 'html', value: '<span>html</span>' },
      ],
    });
  });
});
