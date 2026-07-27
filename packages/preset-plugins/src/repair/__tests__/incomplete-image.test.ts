import type { Image, Paragraph } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import {
  IncompleteImageRepairPlugin,
  type IncompleteImageRepairPluginConfig,
} from '../incomplete-image';
import { paragraph, repairMarkdown, root, runRepairs } from './utils';

interface ImageCase {
  source: string;
  alt: string;
}

const imageCases: ImageCase[] = [
  { source: 'prefix![', alt: 'image' },
  { source: 'prefix![图片', alt: '图片' },
  { source: 'prefix![]', alt: 'image' },
  { source: 'prefix![图片]', alt: '图片' },
  { source: 'prefix![](https://example.test', alt: 'image' },
  { source: 'prefix![图片](https://example.test', alt: '图片' },
];

const tailImage = (source: string, plugin: IncompleteImageRepairPlugin): Image | undefined => {
  const tree = repairMarkdown(source, plugin);
  const container = first(tree.children);

  if (container?.type !== 'paragraph') {
    return undefined;
  }

  const node = last(container.children);

  return node?.type === 'image' ? node : undefined;
};

describe('IncompleteImageRepairPlugin', () => {
  test('keeps system metadata separate from the placeholder strategy', () => {
    const plugin = new IncompleteImageRepairPlugin();

    expect(IncompleteImageRepairPlugin.key).toBe('repair-incomplete-image');
    expect(plugin.config).toEqual({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('normalizes and isolates the default strategy', () => {
    const config: IncompleteImageRepairPluginConfig = {};
    const plugin = new IncompleteImageRepairPlugin(config);

    config.strategy = 'discard';

    expect(tailImage('prefix![streaming', plugin)).toMatchObject({
      type: 'image',
      url: '',
      alt: 'streaming',
    });
  });

  test('keeps ordinary text unchanged', () => {
    const tree = repairMarkdown('ordinary text', new IncompleteImageRepairPlugin());

    expect(first(tree.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'ordinary text' }],
    });
  });

  test('keeps a legitimate sentence-ending exclamation mark', () => {
    const tree = repairMarkdown('Hello!', new IncompleteImageRepairPlugin());

    expect(first(tree.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'Hello!' }],
    });
  });

  test.each(imageCases)('creates a safe placeholder for $source', ({ source, alt }) => {
    expect(tailImage(source, new IncompleteImageRepairPlugin())).toMatchObject({
      type: 'image',
      url: '',
      alt,
    });
  });

  test('preserves a multiline label when repairing a truncated image', () => {
    expect(
      tailImage('prefix ![first line\nsecond line', new IncompleteImageRepairPlugin()),
    ).toMatchObject({
      type: 'image',
      url: '',
      alt: 'first line\nsecond line',
    });
  });

  test.each(imageCases)('discards the incomplete suffix for $source', ({ source }) => {
    const tree = repairMarkdown(source, new IncompleteImageRepairPlugin({ strategy: 'discard' }));
    const container = first(tree.children) as Paragraph;

    expect(container.children).toEqual([{ type: 'text', value: 'prefix' }]);
  });

  test('keeps a complete image unchanged', () => {
    const tree = repairMarkdown(
      'prefix ![image](https://example.test/image.png)',
      new IncompleteImageRepairPlugin(),
    );

    expect(first(tree.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'prefix ' },
        {
          type: 'image',
          url: 'https://example.test/image.png',
          alt: 'image',
        },
      ],
    });
  });

  test('repairs only the final structural branch', () => {
    const tree = root([
      paragraph([{ type: 'text', value: 'first ![not-tail' }]),
      paragraph([{ type: 'text', value: 'last ![tail' }]),
    ]);
    const result = runRepairs(tree, new IncompleteImageRepairPlugin());

    expect(first(result.children)).toEqual(first(tree.children));
    expect(last(result.children)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'last ' },
        { type: 'image', url: '', alt: 'tail' },
      ],
    });
  });

  test('does not skip a later image to repair an earlier candidate', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'prefix ![not-tail' },
        { type: 'image', url: '/tail.png', alt: 'tail' },
      ]),
    ]);

    expect(runRepairs(tree, new IncompleteImageRepairPlugin())).toEqual(tree);
  });

  test('keeps an escaped image opener as literal text', () => {
    const tree = root([paragraph([{ type: 'text', value: 'prefix \\![literal' }])]);

    expect(runRepairs(tree, new IncompleteImageRepairPlugin())).toEqual(tree);
  });
});
