import type { Paragraph, PhrasingContent } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { RedundantTrailingBreakRepairPlugin } from '../redundant-trailing-break';
import { paragraph, root, runRepairs } from './utils';

const repairParagraph = (children: Paragraph['children']): Paragraph => {
  const result = runRepairs(root([paragraph(children)]), new RedundantTrailingBreakRepairPlugin(), {
    ending: false,
  });

  return first(result.children) as Paragraph;
};

describe('RedundantTrailingBreakRepairPlugin', () => {
  test('exposes a matching stable key and final-stage config', () => {
    const plugin = new RedundantTrailingBreakRepairPlugin();

    expect(RedundantTrailingBreakRepairPlugin.key).toBe('repair-redundant-trailing-break');
    expect(plugin.config).toMatchObject({ priority: PluginPriority.Lowest });
    expect(plugin.config.ending).toBeFalsy();
  });

  test('removes a break at the end of a non-inline container', () => {
    expect(
      repairParagraph([{ type: 'text', value: 'prefix' }, { type: 'break' }]).children,
    ).toEqual([{ type: 'text', value: 'prefix' }]);
  });

  test.each<PhrasingContent>([
    {
      type: 'strong',
      children: [{ type: 'text', value: 'prefix' }, { type: 'break' }],
    },
    {
      type: 'emphasis',
      children: [{ type: 'text', value: 'prefix' }, { type: 'break' }],
    },
    {
      type: 'delete',
      children: [{ type: 'text', value: 'prefix' }, { type: 'break' }],
    },
    {
      type: 'link',
      url: '#',
      children: [{ type: 'text', value: 'prefix' }, { type: 'break' }],
    },
  ])('keeps trailing breaks inside inline containers', (inline) => {
    const tree = root([paragraph([inline])]);

    expect(runRepairs(tree, new RedundantTrailingBreakRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('keeps a non-final break in a non-inline container', () => {
    const tree = root([paragraph([{ type: 'break' }, { type: 'text', value: 'suffix' }])]);

    expect(runRepairs(tree, new RedundantTrailingBreakRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('removes repeated LF line endings from the final text', () => {
    expect(repairParagraph([{ type: 'text', value: 'prefix\n\n' }]).children).toEqual([
      { type: 'text', value: 'prefix' },
    ]);
  });

  test.each(['prefix\r\n', 'prefix\r', 'prefix\r\n\r\n'])(
    'removes complete CRLF or CR endings without leaving a carriage return',
    (value) => {
      expect(repairParagraph([{ type: 'text', value }]).children).toEqual([
        { type: 'text', value: 'prefix' },
      ]);
    },
  );

  test('keeps a non-final text line ending unchanged', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'prefix\n' },
        { type: 'text', value: 'suffix' },
      ]),
    ]);

    expect(runRepairs(tree, new RedundantTrailingBreakRepairPlugin(), { ending: false })).toEqual(
      tree,
    );
  });

  test('removes the text node when it contains only redundant line endings', () => {
    expect(repairParagraph([{ type: 'text', value: '\r\n' }]).children).toEqual([]);
  });
});
