import { render } from 'functive';

import { Range } from '../index';

describe('Range', () => {
  test('starts at null and remains writable through its range API', () => {
    const range = render(Range);
    const next = jest.fn();

    range.value.subscribe(next);

    expect(range.value.value).toBe(null);
    expect(range.value.closed).toBe(false);

    range.setRange({ start: 2, end: 5 });

    expect(range.value.value).toEqual({ start: 2, end: 5 });

    range.setRange();

    expect(range.value.value).toBe(null);
    expect(next.mock.calls).toEqual([[null], [{ start: 2, end: 5 }], [null]]);

    range.destroy();
    range.setRange({ start: 9 });

    expect(range.value.closed).toBe(true);
    expect(range.value.value).toBe(null);
  });
});
