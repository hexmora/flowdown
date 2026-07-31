import type { List, Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteListMarkerRepairPlugin } from '../incomplete-list-marker';
import { paragraph, root, runRepairs } from './utils';

describe('IncompleteListMarkerRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new IncompleteListMarkerRepairPlugin();

    expect(IncompleteListMarkerRepairPlugin.key).toBe('repair-incomplete-list-marker');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test.each(['2024', '0', '1234567890'])('keeps a document containing numeric prose', (value) => {
    const tree = root([paragraph([{ type: 'text', value }])]);

    expect(runRepairs(tree, new IncompleteListMarkerRepairPlugin())).toEqual(tree);
  });

  test('keeps a numeric final prose line without a list delimiter', () => {
    const tree = root([paragraph([{ type: 'text', value: 'released in\n2024' }])]);

    expect(runRepairs(tree, new IncompleteListMarkerRepairPlugin())).toEqual(tree);
  });

  test.each(['1.', '-'])('removes an explicit dangling marker on the final line', (marker) => {
    const tree = root([paragraph([{ type: 'text', value: `prefix\n${marker}` }])]);
    const result = runRepairs(tree, new IncompleteListMarkerRepairPlugin());
    const container = first(result.children) as Paragraph;

    expect(container.children).toEqual([{ type: 'text', value: 'prefix' }]);
  });

  test.each(['  1.', '\t-', '   +', '  *', '  2)'])(
    'removes an indented dangling marker on the final line: %s',
    (marker) => {
      const tree = root([paragraph([{ type: 'text', value: `prefix\n${marker}` }])]);
      const result = runRepairs(tree, new IncompleteListMarkerRepairPlugin());
      const container = first(result.children) as Paragraph;

      expect(container.children).toEqual([{ type: 'text', value: 'prefix' }]);
    },
  );

  test('repairs a dangling marker in the final paragraph of a list item', () => {
    const list: List = {
      type: 'list',
      ordered: true,
      children: [
        {
          type: 'listItem',
          children: [paragraph([{ type: 'text', value: 'item\n2.' }])],
        },
      ],
    };
    const result = runRepairs(root([list]), new IncompleteListMarkerRepairPlugin());
    const repairedList = last(result.children) as List;
    const item = last(repairedList.children);
    const container = last(item?.children ?? []) as Paragraph;

    expect(container.children).toEqual([{ type: 'text', value: 'item' }]);
  });

  test('does not repair a marker outside the structural tail', () => {
    const tree = root([
      paragraph([{ type: 'text', value: 'prefix\n1.' }]),
      paragraph([{ type: 'text', value: 'tail' }]),
    ]);

    expect(runRepairs(tree, new IncompleteListMarkerRepairPlugin())).toEqual(tree);
  });

  test('does not run outside ending mode', () => {
    const tree = root([paragraph([{ type: 'text', value: 'prefix\n1.' }])]);

    expect(runRepairs(tree, new IncompleteListMarkerRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });
});
