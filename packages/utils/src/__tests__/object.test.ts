import { describe, expect, test } from 'vitest';

import { defaultsPartial } from '../object';

describe('defaultsPartial', () => {
  test('fills missing values without mutating either input', () => {
    const value = { enabled: true };
    const source = { enabled: false, label: 'default' };

    expect(defaultsPartial(value, source)).toEqual({ enabled: true, label: 'default' });
    expect(value).toEqual({ enabled: true });
    expect(source).toEqual({ enabled: false, label: 'default' });
  });
});
