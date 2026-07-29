import type { Blockquote, Paragraph, Root, Text } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { processRepairByPlugins } from '../../utils/repair-runner';
import { AdjacentTextRepairPlugin } from '../adjacent-text';
import { paragraph, root, runRepairs } from './utils';

describe('AdjacentTextRepairPlugin', () => {
  test('exposes a matching stable key and final-stage config', () => {
    const plugin = new AdjacentTextRepairPlugin();

    expect(AdjacentTextRepairPlugin.key).toBe('repair-adjacent-text');
    expect(plugin.config).toMatchObject({ priority: PluginPriority.Lowest });
    expect(plugin.config.ending).toBeFalsy();
  });

  test('merges adjacent text at one level without crossing non-text boundaries', () => {
    const tree: Root = root([
      paragraph([
        { type: 'text', value: 'abc' },
        { type: 'text', value: 'def' },
        { type: 'html', value: '<div />' },
        { type: 'text', value: '123' },
        { type: 'text', value: '456' },
      ]),
    ]);
    const result = runRepairs(tree, new AdjacentTextRepairPlugin(), { ending: false });

    expect(first(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'abcdef' },
        { type: 'html', value: '<div />' },
        { type: 'text', value: '123456' },
      ],
    });
  });

  test('merges adjacent text independently at every nested level', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'abc' },
        { type: 'text', value: 'def' },
        {
          type: 'link',
          url: 'https://example.test',
          children: [
            { type: 'text', value: '123' },
            { type: 'text', value: '456' },
          ],
        },
        { type: 'html', value: '<div />' },
      ]),
    ]);
    const result = runRepairs(tree, new AdjacentTextRepairPlugin(), { ending: false });

    expect(first(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'abcdef' },
        {
          type: 'link',
          url: 'https://example.test',
          children: [{ type: 'text', value: '123456' }],
        },
        { type: 'html', value: '<div />' },
      ],
    });
  });

  test('removes empty text nodes while preserving meaningful boundaries', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: '' },
        { type: 'html', value: '<div />' },
        { type: 'text', value: '' },
      ]),
    ]);
    const result = runRepairs(tree, new AdjacentTextRepairPlugin(), { ending: false });

    expect(first(result.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'html', value: '<div />' }],
    });
  });

  test('keeps an isolated text node identity and metadata unchanged', () => {
    const text: Text = {
      type: 'text',
      value: 'stable',
      data: { stable: true },
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 7, offset: 6 },
      },
    };
    const container = paragraph([text]);
    const tree = root([container]);

    processTreeInPlace(tree);

    expect(first(container.children)).toBe(text);
    expect(first(container.children)).toEqual(text);
  });

  test('keeps the first metadata and spans the full merged source position', () => {
    const tree = root([
      paragraph([
        {
          type: 'text',
          value: 'first',
          data: { source: 'first' },
          position: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 6, offset: 5 },
          },
        },
        {
          type: 'text',
          value: 'second',
          position: {
            start: { line: 1, column: 6, offset: 5 },
            end: { line: 1, column: 12, offset: 11 },
          },
        },
      ]),
    ]);
    const result = runRepairs(tree, new AdjacentTextRepairPlugin(), { ending: false });
    const container = first(result.children);

    expect(container?.type === 'paragraph' ? first(container.children) : undefined).toEqual({
      type: 'text',
      value: 'firstsecond',
      data: { source: 'first' },
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 1, column: 12, offset: 11 },
      },
    });
  });

  test('handles a deeply nested tree without recursive stack growth', () => {
    const leaf: Paragraph = paragraph([
      { type: 'text', value: 'a' },
      { type: 'text', value: 'b' },
    ]);
    let nested: Paragraph | Blockquote = leaf;

    for (let depth = 0; depth < 4_000; depth += 1) {
      nested = { type: 'blockquote', children: [nested] };
    }

    const tree = root([nested]);

    expect(() => processTreeInPlace(tree)).not.toThrow();

    let current: Paragraph | Blockquote = nested;

    while (current.type === 'blockquote') {
      const child = first(current.children);

      expect(child).toBeDefined();
      current = child as Paragraph | Blockquote;
    }

    expect(last(current.children)).toMatchObject({ type: 'text', value: 'ab' });
  }, 2_000);
});

const processTreeInPlace = (tree: Root): void => {
  const plugin = new AdjacentTextRepairPlugin();

  // Avoid cloneDeep here so the identity and deep-stack assertions cover the plugin itself.
  processRepairByPlugins({ node: tree, plugins: [plugin], ending: false });
};
