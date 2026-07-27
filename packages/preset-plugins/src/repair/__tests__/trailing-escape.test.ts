import type { Root } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first, last } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import { TrailingEscapeRepairPlugin } from '../trailing-escape';
import { paragraph, root, runRepairs } from './utils';

describe('TrailingEscapeRepairPlugin', () => {
  test('exposes a matching stable key and ending-only config', () => {
    const plugin = new TrailingEscapeRepairPlugin();

    expect(TrailingEscapeRepairPlugin.key).toBe('repair-trailing-escape');
    expect(plugin.config).toMatchObject({
      ending: true,
      priority: PluginPriority.Default,
    });
  });

  test('removes one incomplete trailing escape from the structural tail text', () => {
    const tree: Root = root([
      paragraph([
        { type: 'text', value: 'first' },
        { type: 'inlineCode', value: 'code' },
        { type: 'text', value: 'tail\\' },
      ]),
    ]);
    const result = runRepairs(tree, new TrailingEscapeRepairPlugin());
    const container = first(result.children);
    const tail = last(container?.type === 'paragraph' ? container.children : []);

    expect(tail).toMatchObject({ type: 'text', value: 'tail' });
  });

  test('leaves complete text unchanged', () => {
    const tree = root([paragraph([{ type: 'text', value: 'p\\refix' }])]);

    expect(runRepairs(tree, new TrailingEscapeRepairPlugin())).toEqual(tree);
  });

  test('does not run outside ending mode', () => {
    const tree = root([paragraph([{ type: 'text', value: 'tail\\' }])]);

    expect(runRepairs(tree, new TrailingEscapeRepairPlugin(), { ending: false })).toEqual(tree);
  });

  test('does not skip a later non-text leaf to modify earlier content', () => {
    const tree = root([
      paragraph([
        { type: 'text', value: 'not-the-tail\\' },
        { type: 'image', url: '/tail.png', alt: 'tail' },
      ]),
    ]);

    expect(runRepairs(tree, new TrailingEscapeRepairPlugin())).toEqual(tree);
  });
});
