import type { IReactiveState } from '@flowdown/reactive';

import { MutableState } from '@flowdown/reactive';
import { describe, expect, test, vi } from 'vitest';

import type { BlockListItemContext } from '..';
import type { HastRoot } from '../../../../../../../typings';

import { BlockListStateClosure } from '..';

const getObserverCount = (state: IReactiveState<unknown>) => {
  return (
    state as unknown as {
      subject: { observers: unknown[] };
    }
  ).subject.observers.length;
};

describe('BlockListStateClosure', () => {
  test('rolls back children when a later source fails to build', () => {
    const contexts: IReactiveState<BlockListItemContext>[] = [];

    const source = MutableState.of<HastRoot>({ type: 'root', children: [] });

    const createSource = vi.fn((context: IReactiveState<BlockListItemContext>) => {
      contexts.push(context);

      if (contexts.length === 2) {
        throw new Error('Failed to build block source.');
      }

      return source;
    });

    const closure = new BlockListStateClosure({
      createSource,
      sections: [
        { text: 'first', patches: [] },
        { text: 'second', patches: [] },
      ],
    });

    expect(() => closure.value).toThrowError('Failed to build block source.');

    expect(createSource).toHaveBeenCalledTimes(2);

    expect(contexts).toHaveLength(2);

    expect(contexts.every((context) => context.closed)).toBe(true);

    expect(getObserverCount(source)).toBe(0);

    const blocks = closure.value.value;

    expect(blocks.map((block) => block.meta.value.key)).toEqual(['1', '2']);

    expect(createSource).toHaveBeenCalledTimes(4);

    expect(getObserverCount(source)).toBe(2);

    closure.destroy();

    expect(getObserverCount(source)).toBe(0);

    expect(source.closed).toBe(false);
  });
});
