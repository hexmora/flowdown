import type { ThemeTokens } from '../../types';

export const BASE_TOKENS: Omit<ThemeTokens, 'colors' | 'syntax'> = {
  typography: {
    fontSans:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",

    fontMono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",

    fontSize: { xs: '0.75rem', sm: '0.875rem', md: '1rem', lg: '1.125rem', xl: '1.25rem' },

    lineHeight: { sm: 1.4, md: 1.65, lg: 1.8 },

    fontWeight: { normal: 400, medium: 600, bold: 650 },
  },

  heading: {
    h1: {
      fontSize: '2rem',

      fontWeight: 650,

      lineHeight: 1.25,

      marginTop: '2rem',

      marginBottom: '1rem',
    },

    h2: {
      fontSize: '1.5rem',

      fontWeight: 650,

      lineHeight: 1.3,

      marginTop: '1.75rem',

      marginBottom: '0.875rem',
    },

    h3: {
      fontSize: '1.25rem',

      fontWeight: 600,

      lineHeight: 1.4,

      marginTop: '1.5rem',

      marginBottom: '0.75rem',
    },

    h4: {
      fontSize: '1.125rem',

      fontWeight: 600,

      lineHeight: 1.4,

      marginTop: '1.25rem',

      marginBottom: '0.625rem',
    },

    h5: {
      fontSize: '1rem',

      fontWeight: 600,

      lineHeight: 1.5,

      marginTop: '1rem',

      marginBottom: '0.5rem',
    },

    h6: {
      fontSize: '0.875rem',

      fontWeight: 600,

      lineHeight: 1.5,

      marginTop: '1rem',

      marginBottom: '0.5rem',
    },
  },

  paragraph: { marginTop: '0', marginBottom: '1rem' },

  code: { fontSize: '0.875rem', lineHeight: 1.65 },

  radius: { sm: '0.25rem', md: '0.5rem', lg: '0.875rem' },

  spacing: { xs: '0.25rem', sm: '0.5rem', md: '0.75rem', lg: '1rem', xl: '1.5rem' },
};
