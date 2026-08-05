import type { Element, Nodes } from 'hast';

import { describe, expect, test } from 'vitest';

import { markdownToHast } from '../../remark/__tests__/utils';
import { RawParserRehypePlugin } from '../index';

const findElement = (root: Nodes, tagName: string): Element | undefined => {
  if (root.type === 'element' && root.tagName === tagName) {
    return root;
  }

  if (!('children' in root)) {
    return undefined;
  }

  for (const child of root.children) {
    const match = findElement(child, tagName);

    if (match) {
      return match;
    }
  }

  return undefined;
};

const containsRawNode = (root: Nodes): boolean => {
  if (root.type === 'raw') {
    return true;
  }

  return 'children' in root && root.children.some(containsRawNode);
};

describe('RawParserRehypePlugin', () => {
  test('parses embedded HTML into standard HAST before sanitization', () => {
    const root = markdownToHast({
      text: 'before <mark data-token="kept">inside</mark> after',
      rehypes: [new RawParserRehypePlugin()],
    });
    const mark = findElement(root, 'mark');

    expect(containsRawNode(root)).toBe(false);
    expect(mark?.properties).toMatchObject({ dataToken: 'kept' });
    expect(mark?.children).toEqual([
      expect.objectContaining({
        type: 'text',
        value: 'inside',
      }),
    ]);

    const paragraph = findElement(root, 'p');

    expect(paragraph?.children.map((node) => node.type)).toEqual(['text', 'element', 'text']);
  });

  test('passes parser configuration to rehype-raw', () => {
    const config = { tagfilter: true };
    const plugin = new RawParserRehypePlugin(config);

    config.tagfilter = false;

    const root = markdownToHast({
      text: '<script>alert(1)</script>',
      rehypes: [plugin],
    });

    expect(findElement(root, 'script')).toBeUndefined();
    expect(containsRawNode(root)).toBe(false);
  });
});
