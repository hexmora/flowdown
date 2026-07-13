import type { Element, Root, Text } from 'hast';

import { describe, expect, test } from 'vitest';

import { isHastElement, isHastLeafElement, isHastParent, isHastText } from '../detect';

describe('hast node detection', () => {
  const text: Text = { type: 'text', value: 'hello' };
  const leaf: Element = { type: 'element', tagName: 'br', properties: {}, children: [] };
  const root: Root = { type: 'root', children: [text, leaf] };

  test('detects parents by their children array', () => {
    expect(isHastParent(root)).toBe(true);
    expect(isHastParent(text)).toBe(false);
  });

  test('detects elements and optional tag names', () => {
    expect(isHastElement(leaf)).toBe(true);
    expect(isHastElement(leaf, 'br')).toBe(true);
    expect(isHastElement(leaf, 'span')).toBe(false);
    expect(isHastElement(undefined)).toBe(false);
  });

  test('detects leaf elements and text nodes', () => {
    expect(isHastLeafElement(leaf)).toBe(true);
    expect(isHastText(text)).toBe(true);
    expect(isHastText(leaf)).toBe(false);
  });
});
