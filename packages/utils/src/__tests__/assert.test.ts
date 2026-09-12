import { assert } from '../assert';

describe('assert', () => {
  test('does not throw for truthy values', () => {
    expect(() => {
      assert(1);
    }).not.toThrow();
  });

  test('throws AssertError for falsy values', () => {
    expect(() => {
      assert(null, 'missing value');
    }).toThrow(expect.objectContaining({ name: 'assert_error', message: 'missing value' }));
  });
});
