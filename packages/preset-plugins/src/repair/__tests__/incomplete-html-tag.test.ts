import type { Literal, Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { IncompleteHtmlTagRepairPlugin } from '../incomplete-html-tag';
import { paragraph, root, runRepairs } from './utils';

const incompleteOpeningTags = [
  '<',
  '<img',
  '<img/',
  '<img /',
  '<img src',
  '<img src=',
  '<img src="',
  '<img src="abc',
  '<img src="abc"',
  '<img src="abc"/',
  '<img src="abc" /',
  '<img src="abc" alt',
  '<img src="abc" alt="',
  '<img src="abc" alt="test',
  '<img src="abc" alt="test"',
  '<img src="abc" alt="test"/',
  '<img src="abc" alt="test" /',
];

const completeTags = [
  '<img>',
  '<img/>',
  '<img />',
  '<img src="abc"/>',
  '<img src="abc" />',
  '</img>',
  '<x-card2 open>',
  '<x-card2 data-id=example>',
];

const repairLiteral = (type: 'text' | 'html', value: string): Literal | undefined => {
  const result = runRepairs(
    root([paragraph([{ type, value }])]),
    new IncompleteHtmlTagRepairPlugin(),
    { ending: false },
  );
  const container = first(result.children) as Paragraph;
  const node = last(container.children);

  return node && 'value' in node ? node : undefined;
};

describe('IncompleteHtmlTagRepairPlugin', () => {
  test('exposes a matching stable key and always-on config', () => {
    const plugin = new IncompleteHtmlTagRepairPlugin();

    expect(IncompleteHtmlTagRepairPlugin.key).toBe('repair-incomplete-html-tag');
    expect(plugin.config).toMatchObject({ priority: PluginPriority.Default });
    expect(plugin.config.ending).toBeFalsy();
  });

  test.each(incompleteOpeningTags)('removes an incomplete opening tag suffix: %s', (suffix) => {
    expect(repairLiteral('text', `prefix${suffix}`)).toMatchObject({
      type: 'text',
      value: 'prefix',
    });
  });

  test.each(['</', '</img'])('removes an incomplete closing tag suffix: %s', (suffix) => {
    expect(repairLiteral('text', `prefix${suffix}`)).toMatchObject({
      type: 'text',
      value: 'prefix',
    });
  });

  test.each(completeTags)('keeps a complete HTML tag unchanged: %s', (suffix) => {
    expect(repairLiteral('text', `prefix${suffix}`)).toMatchObject({
      type: 'text',
      value: `prefix${suffix}`,
    });
  });

  test('keeps ordinary text unchanged', () => {
    expect(repairLiteral('text', 'prefix')).toMatchObject({
      type: 'text',
      value: 'prefix',
    });
  });

  test('repairs a raw HTML literal as the structural tail', () => {
    expect(repairLiteral('html', '<span>prefix<img src="abc" /')).toMatchObject({
      type: 'html',
      value: '<span>prefix',
    });
  });

  test('does not skip a later non-target leaf to modify earlier text', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'prefix<img' },
        { type: 'image', url: '/tail.png', alt: 'tail' },
      ]),
    ]);

    expect(runRepairs(tree, new IncompleteHtmlTagRepairPlugin(), { ending: false })).toEqual(tree);
  });

  test('supports incomplete custom-element names containing digits', () => {
    expect(repairLiteral('text', 'prefix<x-card2 data-id')).toMatchObject({
      type: 'text',
      value: 'prefix',
    });
  });

  test('handles a long malformed suffix without pathological slowdown', () => {
    const value = `prefix<x-card data-value="${'a'.repeat(50_000)}`;

    expect(repairLiteral('text', value)).toMatchObject({
      type: 'text',
      value: 'prefix',
    });
  }, 2_000);
});
