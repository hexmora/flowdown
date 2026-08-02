import type { IRepairPlugin, RepairPluginRunner } from '@flowdown/types';
import type { Root } from 'mdast';

import { PluginPriority } from '@flowdown/types';
import { first } from 'lodash-es';
import { unified } from 'unified';
import { describe, expect, test, vi } from 'vitest';

import { PRESET_REPAIR_PLUGINS } from '../../repair';
import { paragraph, root } from '../../repair/__tests__/utils';
import { AdjacentTextRepairPlugin } from '../../repair/adjacent-text';
import { BaseRepairPlugin } from '../../repair/base';
import { DanglingFootnoteRepairPlugin } from '../../repair/dangling-footnote';
import { HtmlBoundaryLineBreakRepairPlugin } from '../../repair/html-boundary-line-break';
import { IncompleteCodeFenceRepairPlugin } from '../../repair/incomplete-code-fence';
import { IncompleteEmphasisRepairPlugin } from '../../repair/incomplete-emphasis';
import { IncompleteHtmlTagRepairPlugin } from '../../repair/incomplete-html-tag';
import { IncompleteImageRepairPlugin } from '../../repair/incomplete-image';
import { IncompleteInlineCodeRepairPlugin } from '../../repair/incomplete-inline-code';
import { IncompleteLinkRepairPlugin } from '../../repair/incomplete-link';
import { IncompleteListMarkerRepairPlugin } from '../../repair/incomplete-list-marker';
import { IncompleteStrongRepairPlugin } from '../../repair/incomplete-strong';
import { ParagraphHtmlClosureRepairPlugin } from '../../repair/paragraph-html-closure';
import { RedundantBreakBeforeHtmlRepairPlugin } from '../../repair/redundant-break-before-html';
import { RedundantTrailingBreakRepairPlugin } from '../../repair/redundant-trailing-break';
import { TrailingEmptyCodeBlockRepairPlugin } from '../../repair/trailing-empty-code-block';
import { TrailingEmptyHeadingRepairPlugin } from '../../repair/trailing-empty-heading';
import { TrailingEscapeRepairPlugin } from '../../repair/trailing-escape';
import { ApplyRepairsRemarkPlugin } from '../apply-repairs';

class RecordingRepairPlugin extends BaseRepairPlugin {
  static readonly key = 'repair-test-recording';

  readonly config: IRepairPlugin['config'];

  visits = 0;

  runner: RepairPluginRunner;

  constructor(
    private readonly label: string,
    private readonly events: string[],
    config: IRepairPlugin['config'] = {},
  ) {
    super();
    this.config = config;
    this.runner = ({ node }) => {
      if (node.type === 'root') {
        this.visits += 1;
        this.events.push(this.label);
      }
    };
  }
}

const applyRepairs = (tree: Root, plugin: ApplyRepairsRemarkPlugin): Root => {
  return unified().use(plugin.plugin).runSync(tree) as Root;
};

describe('ApplyRepairsRemarkPlugin', () => {
  test('exposes only its high-priority system config', () => {
    const plugin = new ApplyRepairsRemarkPlugin({ plugins: [] });

    expect(ApplyRepairsRemarkPlugin.key).toBe('remark-apply-repairs');
    expect(plugin.config).toEqual({
      priority: PluginPriority.High,
    });
  });

  test('is a no-op with an empty explicit plugin list', () => {
    const tree = root([paragraph([{ type: 'text', value: 'tail\\' }])]);
    const plugin = new ApplyRepairsRemarkPlugin({ plugins: [], ending: true });

    expect(applyRepairs(tree, plugin)).toEqual(tree);
  });

  test('uses the supplied instances without retaining the caller list', () => {
    const events: string[] = [];
    const repair = new RecordingRepairPlugin('instance', events);
    const late = new RecordingRepairPlugin('late', events);
    const plugins = [repair];
    const remark = new ApplyRepairsRemarkPlugin({ plugins });

    plugins.push(late);
    applyRepairs(root([]), remark);

    expect(repair.visits).toBe(1);
    expect(late.visits).toBe(0);
    expect(events).toEqual(['instance']);
  });

  test('sorts by priority while preserving input order inside a priority bucket', () => {
    const events: string[] = [];
    const low = new RecordingRepairPlugin('low', events, {
      priority: PluginPriority.Low,
    });
    const secondDefault = new RecordingRepairPlugin('default-b', events);
    const highest = new RecordingRepairPlugin('highest', events, {
      priority: PluginPriority.Highest,
    });
    const firstDefault = new RecordingRepairPlugin('default-a', events);

    applyRepairs(
      root([]),
      new ApplyRepairsRemarkPlugin({
        plugins: [low, secondDefault, highest, firstDefault],
      }),
    );

    expect(events).toEqual(['highest', 'default-b', 'default-a', 'low']);
  });

  test('filters ending-only plugins unless ending mode is enabled', () => {
    const inactiveEvents: string[] = [];
    const always = new RecordingRepairPlugin('always', inactiveEvents);
    const ending = new RecordingRepairPlugin('ending', inactiveEvents, {
      ending: true,
    });

    applyRepairs(
      root([]),
      new ApplyRepairsRemarkPlugin({ plugins: [always, ending], ending: false }),
    );

    expect(inactiveEvents).toEqual(['always']);

    const activeEvents: string[] = [];

    applyRepairs(
      root([]),
      new ApplyRepairsRemarkPlugin({
        plugins: [
          new RecordingRepairPlugin('always', activeEvents),
          new RecordingRepairPlugin('ending', activeEvents, { ending: true }),
        ],
        ending: true,
      }),
    );

    expect(activeEvents).toEqual(['always', 'ending']);
  });

  test('isolates runner errors by default and continues with later plugins', () => {
    const events: string[] = [];
    class ThrowingRepairPlugin extends BaseRepairPlugin {
      static readonly key = 'repair-test-throwing';

      runner: RepairPluginRunner = ({ node }) => {
        if (node.type === 'root') {
          throw new Error('broken repair');
        }
      };
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      expect(() =>
        applyRepairs(
          root([]),
          new ApplyRepairsRemarkPlugin({
            plugins: [new ThrowingRepairPlugin(), new RecordingRepairPlugin('after-error', events)],
          }),
        ),
      ).not.toThrow();
      expect(events).toEqual(['after-error']);
      expect(error).toHaveBeenCalledOnce();
    } finally {
      error.mockRestore();
    }
  });

  test('passes runner errors through when safe is false', () => {
    class ThrowingRepairPlugin extends BaseRepairPlugin {
      static readonly key = 'repair-test-throwing-unsafe';

      runner: RepairPluginRunner = ({ node }) => {
        if (node.type === 'root') {
          throw new Error('unsafe failure');
        }
      };
    }

    expect(() =>
      applyRepairs(
        root([]),
        new ApplyRepairsRemarkPlugin({
          plugins: [new ThrowingRepairPlugin()],
          safe: false,
        }),
      ),
    ).toThrow('unsafe failure');
  });

  test('preserves lifecycle ordering across multiple runners', () => {
    const events: string[] = [];
    class LifecycleRepairPlugin extends BaseRepairPlugin {
      static readonly key = 'repair-test-lifecycle';

      runner: RepairPluginRunner[] = [
        ({ node }) => {
          if (node.type === 'root') {
            events.push('runner-a');
          }
        },
        ({ node }) => {
          if (node.type === 'root') {
            events.push('runner-b');
          }
        },
      ];

      before = () => events.push('before');

      after = () => events.push('after');

      beforeEach = () => events.push('before-each');

      afterEach = () => events.push('after-each');
    }

    applyRepairs(
      root([]),
      new ApplyRepairsRemarkPlugin({ plugins: [new LifecycleRepairPlugin()] }),
    );

    expect(events).toEqual([
      'before',
      'before-each',
      'runner-a',
      'after-each',
      'before-each',
      'runner-b',
      'after-each',
      'after',
    ]);
  });

  test('runs footnote repair only when its instance is explicitly supplied', () => {
    const unchanged = root([paragraph([{ type: 'text', value: 'text[^missing]' }])]);

    applyRepairs(unchanged, new ApplyRepairsRemarkPlugin({ plugins: [], ending: true }));

    expect(first(unchanged.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'text[^missing]' }],
    });

    const repaired = root([paragraph([{ type: 'text', value: 'text[^missing]' }])]);

    applyRepairs(
      repaired,
      new ApplyRepairsRemarkPlugin({
        plugins: [new DanglingFootnoteRepairPlugin()],
        ending: true,
      }),
    );

    expect(first(repaired.children)).toMatchObject({
      type: 'paragraph',
      children: [{ type: 'text', value: 'text' }],
    });
  });

  test('declares every built-in repair class in the preset', () => {
    expect(PRESET_REPAIR_PLUGINS).toEqual([
      TrailingEscapeRepairPlugin,
      TrailingEmptyCodeBlockRepairPlugin,
      IncompleteCodeFenceRepairPlugin,
      IncompleteInlineCodeRepairPlugin,
      IncompleteImageRepairPlugin,
      IncompleteLinkRepairPlugin,
      TrailingEmptyHeadingRepairPlugin,
      IncompleteHtmlTagRepairPlugin,
      IncompleteStrongRepairPlugin,
      IncompleteEmphasisRepairPlugin,
      IncompleteListMarkerRepairPlugin,
      RedundantBreakBeforeHtmlRepairPlugin,
      HtmlBoundaryLineBreakRepairPlugin,
      ParagraphHtmlClosureRepairPlugin,
      DanglingFootnoteRepairPlugin,
      RedundantTrailingBreakRepairPlugin,
      AdjacentTextRepairPlugin,
    ]);
  });
});
