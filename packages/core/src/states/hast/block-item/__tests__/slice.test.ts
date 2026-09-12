import type { Element, ElementContent, Root, RootContent, Text } from 'hast';

import { sliceHast } from '@fluxdown/utils';
import { create } from 'lodash-es';

import { BlockItem } from '..';

const root = (children: RootContent[]): Root => ({
  type: 'root',
  children,
});

const text = (value: string): Text => ({
  type: 'text',
  value,
});

const element = (tagName: string, children: ElementContent[] = []): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});

class BlockStateSliceHarness extends BlockItem {
  applySlice(value: Root, start: number, end: number) {
    return this.slice(value, start, end);
  }
}

describe('BlockItem slicing', () => {
  const closure = create(BlockStateSliceHarness.prototype) as BlockStateSliceHarness;

  test('delegates visible ranges to sliceHast', () => {
    const source = root([element('p', [text('hello')])]);

    expect(closure.applySlice(source, 1, 4)).toEqual(sliceHast(source, 1, 4));
  });

  test('creates a fresh metadata-preserving empty root for an empty range', () => {
    const source: Root = {
      type: 'root',
      children: [text('hello')],
      data: { sentinel: 'source' },
    };
    const first = closure.applySlice(source, 2, 2);
    const second = closure.applySlice(source, 2, 2);

    expect(first).toEqual({
      type: 'root',
      children: [],
      data: { sentinel: 'source' },
    });
    expect(second).toEqual(first);
    expect(first).not.toBe(second);
    expect(first.children).not.toBe(second.children);
  });
});
