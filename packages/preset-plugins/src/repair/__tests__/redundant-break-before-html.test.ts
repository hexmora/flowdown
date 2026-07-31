import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { RedundantBreakBeforeHtmlRepairPlugin } from '../redundant-break-before-html';
import { paragraph, root, runRepairs } from './utils';

describe('RedundantBreakBeforeHtmlRepairPlugin', () => {
  test('exposes a matching stable key and always-on config', () => {
    const plugin = new RedundantBreakBeforeHtmlRepairPlugin();

    expect(RedundantBreakBeforeHtmlRepairPlugin.key).toBe('repair-redundant-break-before-html');
    expect(plugin.config).toMatchObject({ priority: PluginPriority.Default });
    expect(plugin.config.ending).toBeFalsy();
  });

  test('removes a break immediately before an HTML sibling', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'prefix' },
        { type: 'break' },
        { type: 'html', value: '<span>html</span>' },
      ]),
    ]);
    const result = runRepairs(tree, new RedundantBreakBeforeHtmlRepairPlugin(), {
      ending: false,
    });

    expect(first(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'prefix' },
        { type: 'html', value: '<span>html</span>' },
      ],
    });
  });

  test('keeps a break that is not immediately before HTML', () => {
    const tree = root([paragraph([{ type: 'break' }, { type: 'text', value: 'suffix' }])]);

    expect(runRepairs(tree, new RedundantBreakBeforeHtmlRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('accepts an HTML node at index zero without changing siblings', () => {
    const tree = root([
      paragraph([
        { type: 'html', value: '<span>html</span>' },
        { type: 'text', value: 'suffix' },
      ]),
    ]);

    expect(runRepairs(tree, new RedundantBreakBeforeHtmlRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });
});
