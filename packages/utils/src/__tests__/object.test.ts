import { describe, expect, test } from 'vitest';

import { defaultsBy } from '../object';

describe('defaultsBy', () => {
  test('returns a fresh shallow-defaulted object without mutating either input', () => {
    const value = { enabled: true, label: undefined };
    const source = { enabled: false, label: 'default' };
    const result = defaultsBy(value, source);

    expect(result).toEqual({ enabled: true, label: 'default' });
    expect(result).not.toBe(value);
    expect(result).not.toBe(source);
    expect(value).toEqual({ enabled: true, label: undefined });
    expect(source).toEqual({ enabled: false, label: 'default' });
  });
});
