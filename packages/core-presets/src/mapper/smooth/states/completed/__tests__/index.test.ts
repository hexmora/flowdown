import {
  BatchScheduler,
  combineMapClosure,
  MutableState,
  ReactiveState,
  render,
  S,
} from 'functive';

import { Completed } from '..';

describe('Completed', () => {
  test('ignores values and emits completion without requiring another value', () => {
    const source = MutableState.of(1);

    const completed = render(S([Completed, { source }]));

    const next = jest.fn();

    const complete = jest.fn();

    completed.value.subscribe({ next, complete });

    expect(completed.value.value).toBe(false);

    source.next(2);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(false);

    source.complete();

    expect(next.mock.calls).toEqual([[false], [true]]);

    expect(completed.value.closed).toBe(true);

    expect(complete).toHaveBeenCalledTimes(1);

    completed.destroy();
  });

  test('starts completed when its source has already finished', () => {
    const source = ReactiveState.of('ready');

    const completed = render(S([Completed, { source }]));

    expect(completed.value.value).toBe(true);

    expect(completed.value.closed).toBe(true);

    completed.destroy();
  });

  test('settles a final value and completion in the same batch', () => {
    const source = MutableState.of(1);

    const completed = render(S([Completed, { source }]));

    const output = combineMapClosure([source, completed], ([value, closed]) => ({ value, closed }));

    const next = jest.fn();

    output.value.subscribe(next);

    next.mockClear();

    BatchScheduler.batch(() => {
      source.next(2);

      source.complete();
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith({ value: 2, closed: true });

    expect(output.value.closed).toBe(true);

    output.destroy();
  });

  test('observes completion when first initialized inside a pending batch', () => {
    const source = MutableState.of(1);

    const completed = render(S([Completed, { source }]));

    BatchScheduler.batch(() => {
      source.next(2);

      source.complete();

      expect(completed.value.value).toBe(false);
    });

    expect(completed.value.value).toBe(true);

    expect(completed.value.closed).toBe(true);

    completed.destroy();
  });

  test('forwards source errors without reporting successful completion', () => {
    const source = MutableState.of(1);

    const completed = render(S([Completed, { source }]));

    const failure = new Error('Source failed.');

    const next = jest.fn();

    const error = jest.fn();

    const complete = jest.fn();

    completed.value.subscribe({ next, error, complete });

    source.error(failure);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(false);

    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(failure);

    expect(complete).not.toHaveBeenCalled();

    expect(completed.value.closed).toBe(true);

    completed.destroy();
  });

  test('releases its subscription without destroying the borrowed source', () => {
    const source = MutableState.of(1);

    const subscribe = jest.spyOn(source, 'subscribe');

    const completed = render(S([Completed, { source }]));

    expect(subscribe).not.toHaveBeenCalled();

    expect(completed.value.value).toBe(false);

    expect(subscribe).toHaveBeenCalledTimes(1);

    const [subscription] = subscribe.mock.results;

    if (subscription.type !== 'return') {
      throw new Error('Expected subscribe to return a subscription');
    }

    expect(subscription.value.closed).toBe(false);

    completed.destroy();

    completed.destroy();

    expect(subscription.value.closed).toBe(true);

    expect(source.closed).toBe(false);

    source.next(2);

    expect(source.value).toBe(2);

    source.destroy();
  });
});
