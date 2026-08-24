import type { PluginClass } from '@flowdown/types';

import type { AnySlotPlugin } from '../../types';

import { BlockquoteSlotPlugin } from './blockquote';
import { BreakLineSlotPlugin } from './break-line';
import { CodeBlockSlotPlugin } from './code-block';
import { CodeHeaderSlotPlugin } from './code-header';
import { CodeHighlighterSlotPlugin } from './code-highlighter';
import { EmphasisSlotPlugin } from './emphasis';
import { HeadingSlotPlugin } from './heading';
import { ImageSlotPlugin } from './image';
import { LinkSlotPlugin } from './link';
import { ListSlotPlugin } from './list';
import { ParagraphSlotPlugin } from './paragraph';
import { StrongSlotPlugin } from './strong';
import { TableSlotPlugin } from './table';
import { TexSlotPlugin } from './tex';

export * from './base';
export * from './blockquote';
export * from './break-line';
export * from './code-block';
export * from './code-header';
export * from './code-highlighter';
export * from './emphasis';
export * from './heading';
export * from './image';
export * from './link';
export * from './list';
export * from './paragraph';
export * from './strong';
export * from './table';
export * from './tex';

export const PRESET_SLOT_PLUGINS: PluginClass<AnySlotPlugin>[] = [
  BlockquoteSlotPlugin,
  BreakLineSlotPlugin,
  CodeBlockSlotPlugin,
  CodeHeaderSlotPlugin,
  CodeHighlighterSlotPlugin,
  EmphasisSlotPlugin,
  HeadingSlotPlugin,
  ImageSlotPlugin,
  LinkSlotPlugin,
  ListSlotPlugin,
  ParagraphSlotPlugin,
  StrongSlotPlugin,
  TableSlotPlugin,
  TexSlotPlugin,
];
