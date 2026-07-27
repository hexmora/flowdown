import type { Link, Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteLinkRepairPlugin } from '../incomplete-link';
import { paragraph, repairMarkdown, root, runRepairs } from './utils';

interface LinkCase {
  source: string;
  label: string;
}

const linkCases: LinkCase[] = [
  { source: 'prefix [label', label: 'label' },
  { source: 'prefix [[wiki', label: '[wiki' },
  { source: 'prefix [label]', label: 'label' },
  { source: 'prefix [[wiki]]', label: '[wiki]' },
  { source: 'prefix [label](https://example.test', label: 'label' },
  { source: 'prefix [[wiki]](https://example.test', label: '[wiki]' },
];

const tailLink = (source: string): Link | undefined => {
  const tree = repairMarkdown(source, new IncompleteLinkRepairPlugin());
  const container = first(tree.children);

  if (container?.type !== 'paragraph') {
    return undefined;
  }

  const node = last(container.children);

  return node?.type === 'link' ? node : undefined;
};

describe('IncompleteLinkRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new IncompleteLinkRepairPlugin();

    expect(IncompleteLinkRepairPlugin.key).toBe('repair-incomplete-link');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('keeps ordinary text unchanged', () => {
    const tree = repairMarkdown('ordinary text', new IncompleteLinkRepairPlugin());

    expect(first(tree.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'ordinary text' }],
    });
  });

  test('removes an empty trailing link opener', () => {
    const tree = repairMarkdown('prefix [', new IncompleteLinkRepairPlugin());
    const container = first(tree.children) as Paragraph;

    expect(container.children).toEqual([{ type: 'text', value: 'prefix ' }]);
  });

  test.each(linkCases)('creates a placeholder link for $source', ({ source, label }) => {
    expect(tailLink(source)).toMatchObject({
      type: 'link',
      url: '#',
      title: null,
      children: [{ type: 'text', value: label }],
    });
  });

  test('does not reinterpret an incomplete footnote opener as a link', () => {
    const tree = repairMarkdown('prefix [^note', new IncompleteLinkRepairPlugin());

    expect(first(tree.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'prefix [^note' }],
    });
  });

  test.each(['prefix [label](https://example.test)', 'prefix [[wiki]](https://example.test)'])(
    'keeps a complete link unchanged',
    (source) => {
      const original = repairMarkdown(source, new IncompleteLinkRepairPlugin(), {
        ending: false,
      });

      expect(runRepairs(original, new IncompleteLinkRepairPlugin())).toEqual(original);
    },
  );

  test('repairs only the final structural branch', () => {
    const tree = root([
      paragraph([{ type: 'text', value: 'first [not-tail' }]),
      paragraph([{ type: 'text', value: 'last [tail' }]),
    ]);
    const result = runRepairs(tree, new IncompleteLinkRepairPlugin());

    expect(first(result.children)).toEqual(first(tree.children));
    expect(last(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'last ' },
        {
          type: 'link',
          url: '#',
          children: [{ type: 'text', value: 'tail' }],
        },
      ],
    });
  });

  test('uses the nearest unmatched opener on the final line', () => {
    const link = tailLink('prefix [literal and [target');

    expect(link).toMatchObject({
      type: 'link',
      children: [{ type: 'text', value: 'target' }],
    });
  });

  test('does not skip a later code node to repair an earlier candidate', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'prefix [not-tail' },
        { type: 'inlineCode', value: 'tail' },
      ]),
    ]);

    expect(runRepairs(tree, new IncompleteLinkRepairPlugin())).toEqual(tree);
  });

  test('keeps an escaped opener as literal text', () => {
    const tree = root([paragraph([{ type: 'text', value: 'prefix \\[literal' }])]);

    expect(runRepairs(tree, new IncompleteLinkRepairPlugin())).toEqual(tree);
  });
});
