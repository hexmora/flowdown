import type { IRepairPlugin, PluginClass } from '@flowdown/types';

import { AdjacentTextRepairPlugin } from './adjacent-text';
import { DanglingFootnoteRepairPlugin } from './dangling-footnote';
import { HtmlBoundaryLineBreakRepairPlugin } from './html-boundary-line-break';
import { IncompleteCodeFenceRepairPlugin } from './incomplete-code-fence';
import { IncompleteEmphasisRepairPlugin } from './incomplete-emphasis';
import { IncompleteHtmlTagRepairPlugin } from './incomplete-html-tag';
import { IncompleteImageRepairPlugin } from './incomplete-image';
import { IncompleteInlineCodeRepairPlugin } from './incomplete-inline-code';
import { IncompleteLinkRepairPlugin } from './incomplete-link';
import { IncompleteListMarkerRepairPlugin } from './incomplete-list-marker';
import { IncompleteStrongRepairPlugin } from './incomplete-strong';
import { ParagraphHtmlClosureRepairPlugin } from './paragraph-html-closure';
import { RedundantBreakBeforeHtmlRepairPlugin } from './redundant-break-before-html';
import { RedundantTrailingBreakRepairPlugin } from './redundant-trailing-break';
import { TrailingEmptyCodeBlockRepairPlugin } from './trailing-empty-code-block';
import { TrailingEmptyHeadingRepairPlugin } from './trailing-empty-heading';
import { TrailingEscapeRepairPlugin } from './trailing-escape';

export * from './base';
export * from './adjacent-text';
export * from './dangling-footnote';
export * from './html-boundary-line-break';
export * from './incomplete-code-fence';
export * from './incomplete-emphasis';
export * from './incomplete-html-tag';
export * from './incomplete-image';
export * from './incomplete-inline-code';
export * from './incomplete-link';
export * from './incomplete-list-marker';
export * from './incomplete-strong';
export * from './paragraph-html-closure';
export * from './redundant-break-before-html';
export * from './redundant-trailing-break';
export * from './trailing-empty-code-block';
export * from './trailing-empty-heading';
export * from './trailing-escape';

export const PRESET_REPAIR_PLUGINS: PluginClass<IRepairPlugin>[] = [
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
];
