import type { ThemeConfig } from '../../types';

import { BASE_TOKENS } from './base';

export const LIGHT_THEME: ThemeConfig = {
  tokens: {
    ...BASE_TOKENS,

    colors: {
      fg: '#202123',

      fgMuted: '#64676b',

      bg: '#ffffff',

      border: '#e5e7eb',

      accent: '#0969da',

      accentHover: '#0550ae',

      surfaceMuted: '#f1f2f4',

      surfaceSubtle: '#f7f8fa',

      borderEmphasis: '#b5bac1',
    },

    syntax: {
      comment: '#6e7781',

      keyword: '#cf222e',

      string: '#0a3069',

      number: '#0550ae',

      function: '#8250df',

      variable: '#953800',

      punctuation: '#57606a',

      inserted: '#116329',

      deleted: '#a40e26',
    },
  },
};
