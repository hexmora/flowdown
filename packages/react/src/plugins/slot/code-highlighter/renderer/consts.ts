import type { ThemeRegistrationRaw } from 'shiki/core';

import { PREFIX } from '../../../../consts';

const token = (name: string) => `var(--${PREFIX}-${name})`;

export const HIGHLIGHT_THEME_NAME = 'markdown';

export const HIGHLIGHT_THEME: ThemeRegistrationRaw = {
  name: HIGHLIGHT_THEME_NAME,
  settings: [
    {
      settings: {
        foreground: token('colors-fg'),
        background: token('colors-surface-subtle'),
      },
    },
    { scope: 'comment', settings: { foreground: token('syntax-comment') } },
    {
      scope: ['keyword', 'storage'],
      settings: { foreground: token('syntax-keyword') },
    },
    {
      scope: ['string', 'entity.name.tag', 'markup.inline.raw'],
      settings: { foreground: token('syntax-string') },
    },
    {
      scope: ['constant', 'support.constant'],
      settings: { foreground: token('syntax-number') },
    },
    {
      scope: ['entity.name.function', 'support.function', 'entity.name.type'],
      settings: { foreground: token('syntax-function') },
    },
    {
      scope: ['variable', 'entity.other.attribute-name'],
      settings: { foreground: token('syntax-variable') },
    },
    { scope: 'punctuation', settings: { foreground: token('syntax-punctuation') } },
    { scope: 'markup.inserted', settings: { foreground: token('syntax-inserted') } },
    { scope: 'markup.deleted', settings: { foreground: token('syntax-deleted') } },
    { scope: 'markup.bold', settings: { fontStyle: 'bold' } },
    { scope: 'markup.italic', settings: { fontStyle: 'italic' } },
  ],
};
