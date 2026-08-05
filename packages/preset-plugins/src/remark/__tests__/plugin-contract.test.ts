import { PluginPriority } from '@flowdown/types';
import { describe, expect, test } from 'vitest';

import type {
  PandocMathData,
  PandocMathMode,
  ParserPatch,
  ParserPatchData,
  ParserPatchProperties,
} from '../../index';

import {
  ApplyRepairsRemarkPlugin,
  CodeMetaRemarkPlugin,
  PatchesRemarkPlugin,
  PRESET_REMARK_PLUGINS,
  SyntaxAutolinkRemarkPlugin,
  SyntaxFootnoteRemarkPlugin,
  SyntaxHtmlAllowedRemarkPlugin,
  SyntaxMathRemarkPlugin,
  SyntaxPolicyRemarkPlugin,
  SyntaxSoftEndlineRemarkPlugin,
  SyntaxStrikethroughRemarkPlugin,
  SyntaxTableRemarkPlugin,
  SyntaxTaskListRemarkPlugin,
  TableNoralizerRemarkPlugin,
} from '../index';

describe('remark plugin contracts', () => {
  test('exposes unique stable keys for all built-in plugins', () => {
    const keys = PRESET_REMARK_PLUGINS.map((PluginClass) => PluginClass.key);

    expect(keys).toEqual([
      'remark-apply-repairs',
      'remark-code-meta',
      'remark-patches',
      'remark-syntax-autolink',
      'remark-syntax-footnote',
      'remark-syntax-html-allowed',
      'remark-syntax-math',
      'remark-syntax-policy',
      'remark-syntax-soft-endline',
      'remark-syntax-strikethrough',
      'remark-syntax-table',
      'remark-syntax-task-list',
      'remark-table-noralizer',
    ]);
  });

  test('preserves the parser and transformer priority buckets', () => {
    expect(new ApplyRepairsRemarkPlugin().config.priority).toBe(PluginPriority.High);
    expect(new CodeMetaRemarkPlugin().config.priority).toBe(PluginPriority.Lowest);
    expect(new PatchesRemarkPlugin().config.priority).toBe(PluginPriority.Highest);
    expect(new SyntaxAutolinkRemarkPlugin().config.priority).toBe(PluginPriority.Highest);
    expect(new SyntaxFootnoteRemarkPlugin().config.priority).toBe(PluginPriority.Highest);
    expect(new SyntaxHtmlAllowedRemarkPlugin().config.priority).toBe(PluginPriority.Lowest);
    expect(new SyntaxMathRemarkPlugin().config.priority).toBe(PluginPriority.Lowest);
    expect(new SyntaxPolicyRemarkPlugin().config.priority).toBe(PluginPriority.Default);
    expect(new SyntaxSoftEndlineRemarkPlugin().config.priority).toBe(PluginPriority.Low);
    expect(new SyntaxStrikethroughRemarkPlugin().config.priority).toBe(PluginPriority.Highest);
    expect(new SyntaxTableRemarkPlugin().config.priority).toBe(PluginPriority.Highest);
    expect(new SyntaxTaskListRemarkPlugin().config.priority).toBe(PluginPriority.Highest);
    expect(new TableNoralizerRemarkPlugin().config.priority).toBe(PluginPriority.Low);
  });

  test('publishes AST bridge protocol types from the package root', () => {
    const properties: ParserPatchProperties = {
      dataParserPatch: '1',
      dataParserKey: 'cursor',
    };
    const data: ParserPatchData = {
      key: 'cursor',
      hName: 'span',
      hProperties: properties,
    };
    const patch: ParserPatch = {
      type: 'parserPatch',
      data,
    };
    const mode: PandocMathMode = 'display';
    const math: PandocMathData = { mode };

    expect(patch.data.hProperties.dataParserKey).toBe('cursor');
    expect(math.mode).toBe('display');
  });
});
