import { describe, expectTypeOf, test } from 'vitest';

import type {
  ApplyRepairsRemarkPlugin,
  ApplyRepairsRemarkPluginConfig,
} from '../../remark/apply-repairs';
import type {
  AdjacentTextRepairPlugin,
  DanglingFootnoteRepairPlugin,
  HtmlBoundaryLineBreakRepairPlugin,
  IncompleteCodeFenceRepairPlugin,
  IncompleteEmphasisRepairPlugin,
  IncompleteHtmlTagRepairPlugin,
  IncompleteImageRepairPlugin,
  IncompleteImageRepairPluginConfig,
  IncompleteInlineCodeRepairPlugin,
  IncompleteLinkRepairPlugin,
  IncompleteListMarkerRepairPlugin,
  IncompleteStrongRepairPlugin,
  ParagraphHtmlClosureRepairPlugin,
  RedundantBreakBeforeHtmlRepairPlugin,
  RedundantTrailingBreakRepairPlugin,
  TrailingEmptyCodeBlockRepairPlugin,
  TrailingEmptyHeadingRepairPlugin,
  TrailingEscapeRepairPlugin,
} from '../index';

type ParameterlessRepairPluginClass =
  | typeof AdjacentTextRepairPlugin
  | typeof DanglingFootnoteRepairPlugin
  | typeof HtmlBoundaryLineBreakRepairPlugin
  | typeof IncompleteCodeFenceRepairPlugin
  | typeof IncompleteEmphasisRepairPlugin
  | typeof IncompleteHtmlTagRepairPlugin
  | typeof IncompleteInlineCodeRepairPlugin
  | typeof IncompleteLinkRepairPlugin
  | typeof IncompleteListMarkerRepairPlugin
  | typeof IncompleteStrongRepairPlugin
  | typeof ParagraphHtmlClosureRepairPlugin
  | typeof RedundantBreakBeforeHtmlRepairPlugin
  | typeof RedundantTrailingBreakRepairPlugin
  | typeof TrailingEmptyCodeBlockRepairPlugin
  | typeof TrailingEmptyHeadingRepairPlugin
  | typeof TrailingEscapeRepairPlugin;

type ConstructorConfig<T extends abstract new (...args: never[]) => unknown> =
  ConstructorParameters<T>[0];

describe('repair plugin config contracts', () => {
  test('keeps parameterless repairs free of meaningless constructor config', () => {
    expectTypeOf<ConstructorParameters<ParameterlessRepairPluginClass>>().toEqualTypeOf<[]>();
  });

  test('publishes constructor config only for incomplete-image behavior', () => {
    expectTypeOf<ConstructorConfig<typeof IncompleteImageRepairPlugin>>().toEqualTypeOf<
      IncompleteImageRepairPluginConfig | undefined
    >();
  });

  test('publishes a matching named config for the remark repair orchestrator', () => {
    expectTypeOf<ConstructorConfig<typeof ApplyRepairsRemarkPlugin>>().toEqualTypeOf<
      ApplyRepairsRemarkPluginConfig | undefined
    >();
  });
});
