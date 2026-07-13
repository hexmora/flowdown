import type { Paragraph, Root, Text } from 'mdast';

import { describe, expect, test } from 'vitest';

import { isMdastParent } from '../detect';

describe('isMdastParent', () => {
  test('returns true for mdast nodes with children', () => {
    const node: Root = {
      type: 'root',
      children: [],
    };

    expect(isMdastParent(node)).toBe(true);
  });

  test('returns true when children is present but empty', () => {
    const node: Paragraph = {
      type: 'paragraph',
      children: [],
    };

    expect(isMdastParent(node)).toBe(true);
  });

  test('returns false for mdast leaf nodes without children', () => {
    const node: Text = {
      type: 'text',
      value: 'hello',
    };

    expect(isMdastParent(node)).toBe(false);
  });

  test('returns false for nullish values', () => {
    expect(isMdastParent(null)).toBe(false);
    expect(isMdastParent(undefined)).toBe(false);
  });

  test('returns false when children is explicitly undefined', () => {
    expect(isMdastParent({ type: 'paragraph', children: undefined })).toBe(false);
  });

  test('returns false when children is not an array', () => {
    expect(isMdastParent({ children: 'not-an-array' })).toBe(false);
  });
});
