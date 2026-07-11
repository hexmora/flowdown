import { describe, expect, test } from 'vitest';

import { assert, AssertError } from '../assert';

describe('assert', () => {
  test('does not throw for truthy values', () => {
    expect(() => {
      assert(1);
    }).not.toThrow();
  });

  test('throws AssertError for falsy values', () => {
    expect(() => {
      assert(null, 'missing value');
    }).toThrow(AssertError);
  });
});
