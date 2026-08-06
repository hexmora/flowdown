import type { IRehypePlugin } from '@flowdown/types';
import type { Properties, Root, RootContent } from 'hast';

import { create, has, last } from 'lodash-es';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';

import { SyntaxFootnoteRemarkPlugin } from '../../remark';
import { markdownToHast } from '../../remark/__tests__/utils';
import { HoistFootnoteRehypePlugin, RawParserRehypePlugin, SanitizerRehypePlugin } from '../index';

const FOOTNOTE_MARKDOWN = ['A statement with a note[^note].', '', '[^note]: Supporting text.'].join(
  '\n',
);

const getStoredFootnote = (root: Root): RootContent | undefined => {
  return (root.data as { footnote?: RootContent } | undefined)?.footnote;
};

const isFootnoteSection = (node: RootContent | undefined): boolean => {
  return (
    node?.type === 'element' && node.tagName === 'section' && has(node.properties, 'dataFootnotes')
  );
};

const parseFootnote = (hoist: boolean): Root => {
  const rehypes: IRehypePlugin[] = [
    new RawParserRehypePlugin(),
    new SanitizerRehypePlugin({
      allowedTags: [],
    }),
  ];

  if (hoist) {
    rehypes.push(new HoistFootnoteRehypePlugin());
  }

  return markdownToHast({
    text: FOOTNOTE_MARKDOWN,
    remarks: [new SyntaxFootnoteRemarkPlugin()],
    rehypes,
  });
};

const runHoister = (root: Root): Root => {
  const plugin = new HoistFootnoteRehypePlugin();

  return unified().use(plugin.plugin).runSync(root) as Root;
};

describe('HoistFootnoteRehypePlugin', () => {
  test('moves a trailing footnote section into root data', () => {
    const root = parseFootnote(true);
    const footnote = getStoredFootnote(root);

    expect(isFootnoteSection(footnote)).toBe(true);
    expect(isFootnoteSection(last(root.children))).toBe(false);
  });

  test('keeps the trailing footnote section when hoisting is disabled', () => {
    const root = parseFootnote(false);

    expect(getStoredFootnote(root)).toBeUndefined();
    expect(isFootnoteSection(last(root.children))).toBe(true);
  });

  test('preserves root data and stores the exact detached node', () => {
    const previousFootnote: RootContent = {
      type: 'element',
      tagName: 'section',
      properties: { dataFootnotes: true },
      children: [{ type: 'text', value: 'previous' }],
    };
    const tail: RootContent = {
      type: 'element',
      tagName: 'section',
      properties: { dataFootnotes: false },
      children: [{ type: 'text', value: 'current' }],
    };
    const data = { footnote: previousFootnote, stable: 'value' };
    const root: Root = {
      type: 'root',
      data,
      children: [{ type: 'text', value: 'body' }, tail],
    };

    runHoister(root);

    expect(root.children).toEqual([{ type: 'text', value: 'body' }]);
    expect(getStoredFootnote(root)).toBe(tail);
    expect(root.data).toMatchObject({ stable: 'value' });
    expect(root.data).not.toBe(data);
  });

  test('ignores marked sections that are not the final direct child', () => {
    const section: RootContent = {
      type: 'element',
      tagName: 'section',
      properties: { dataFootnotes: true },
      children: [],
    };
    const children: RootContent[] = [section, { type: 'text', value: 'tail' }];
    const data = { stable: true };
    const root: Root = { type: 'root', data, children: children.slice() };

    runHoister(root);

    expect(root.children).toEqual(children);
    expect(root.data).toBe(data);
  });

  test('requires dataFootnotes to be an own property of the trailing section', () => {
    const properties = create({ dataFootnotes: true }) as Properties;
    const tail: RootContent = {
      type: 'element',
      tagName: 'section',
      properties,
      children: [],
    };
    const root: Root = { type: 'root', children: [tail] };

    runHoister(root);

    expect(root.children).toEqual([tail]);
    expect(getStoredFootnote(root)).toBeUndefined();
  });
});
