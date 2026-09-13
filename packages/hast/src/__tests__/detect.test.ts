import type { Element } from 'hast';

import { describe, expect, test } from 'vitest';

import { isHastElement } from '../detect';

describe('hast node detection', () => {
  const leaf: Element = { type: 'element', tagName: 'br', properties: {}, children: [] };

  test('detects elements and optional tag names', () => {
    expect(isHastElement(leaf)).toBe(true);
    expect(isHastElement(leaf, 'br')).toBe(true);
    expect(isHastElement(leaf, 'span')).toBe(false);
    expect(isHastElement(undefined)).toBe(false);
  });
});
