import type { ThemeConfig } from '../../types';

import { BASE_TOKENS } from './base';

export const DARK_THEME: ThemeConfig = {
  tokens: {
    ...BASE_TOKENS,

    colors: {
      fg: '#ececf1',

      fgMuted: '#a6a8b0',

      bg: '#212121',

      border: '#3c3e42',

      accent: '#82b7ff',

      accentHover: '#b1d2ff',

      surfaceMuted: '#353639',

      surfaceSubtle: '#292a2d',

      borderEmphasis: '#666970',
    },

    syntax: {
      comment: '#9da7b3',

      keyword: '#ff7b72',

      string: '#a5d6ff',

      number: '#79c0ff',

      function: '#d2a8ff',

      variable: '#ffa657',

      punctuation: '#c9d1d9',

      inserted: '#7ee787',

      deleted: '#ffa198',
    },
  },
};
