import type { PluginClass } from '@fluxdown/types';

import type { IReactRenderPlugin } from '../base';

import { BlockquoteRenderPlugin } from './blockquote';
import { BreakLineRenderPlugin } from './break-line';
import { CodeRenderPlugin } from './code';
import { EmphasisRenderPlugin } from './emphasis';
import { FallbackRenderPlugin } from './fallback';
import { HeadingRenderPlugin } from './heading';
import { ImageRenderPlugin } from './image';
import { LinkRenderPlugin } from './link';
import { ListRenderPlugin } from './list';
import { ParagraphRenderPlugin } from './paragraph';
import { PatchRenderPlugin } from './patch';
import { ShadRenderPlugin } from './shad';
import { StrongRenderPlugin } from './strong';
import { TableRenderPlugin } from './table';
import { TableCellRenderPlugin } from './table-cell';
import { TexRenderPlugin } from './tex';

export * from './blockquote';
export * from './break-line';
export * from './code';
export * from './emphasis';
export * from './fallback';
export * from './heading';
export * from './image';
export * from './link';
export * from './list';
export * from './paragraph';
export * from './patch';
export * from './shad';
export * from './strong';
export * from './table';
export * from './table-cell';
export * from './tex';

export const PRESET_RENDER_PLUGINS: PluginClass<IReactRenderPlugin>[] = [
  PatchRenderPlugin,
  ShadRenderPlugin,
  CodeRenderPlugin,
  EmphasisRenderPlugin,
  ImageRenderPlugin,
  LinkRenderPlugin,
  ListRenderPlugin,
  ParagraphRenderPlugin,
  StrongRenderPlugin,
  TableRenderPlugin,
  TableCellRenderPlugin,
  TexRenderPlugin,
  HeadingRenderPlugin,
  BreakLineRenderPlugin,
  BlockquoteRenderPlugin,
  FallbackRenderPlugin,
];
