import type { IRemarkPlugin, PluginClass } from '@flowdown/types';

import { ApplyRepairsRemarkPlugin } from './apply-repairs';
import { CodeMetaRemarkPlugin } from './code-meta';
import { PatchesRemarkPlugin } from './patches';
import { SyntaxAutolinkRemarkPlugin } from './syntax-autolink';
import { SyntaxFootnoteRemarkPlugin } from './syntax-footnote';
import { SyntaxHtmlAllowedRemarkPlugin } from './syntax-html-allowed';
import { SyntaxMathRemarkPlugin } from './syntax-math';
import { SyntaxPolicyRemarkPlugin } from './syntax-policy';
import { SyntaxSoftEndlineRemarkPlugin } from './syntax-soft-endline';
import { SyntaxStrikethroughRemarkPlugin } from './syntax-strikethrough';
import { SyntaxTableRemarkPlugin } from './syntax-table';
import { SyntaxTaskListRemarkPlugin } from './syntax-task-list';
import { TableNoralizerRemarkPlugin } from './table-noralizer';

export * from './base';
export * from './apply-repairs';
export * from './syntax-autolink';
export * from './code-meta';
export * from './syntax-footnote';
export * from './syntax-html-allowed';
export * from './syntax-math';
export * from './patches';
export * from './syntax-policy';
export * from './syntax-soft-endline';
export * from './syntax-strikethrough';
export * from './table-noralizer';
export * from './syntax-table';
export * from './syntax-task-list';

export const PRESET_REMARK_PLUGINS: PluginClass<IRemarkPlugin>[] = [
  ApplyRepairsRemarkPlugin,
  CodeMetaRemarkPlugin,
  PatchesRemarkPlugin,
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
];
