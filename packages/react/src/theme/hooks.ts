import type { CSSProperties } from 'react';

import { isEqual, isString } from 'lodash-es';
import { useRef } from 'react';

import type { Theme } from '../types';

import { PRESET_STYLES } from './consts';
import { mapTokensToStyles, resolveTheme } from './utils';

export const useThemeStyles = (theme: Theme = 'light'): CSSProperties => {
  const cache = useRef<{ theme: Theme; styles: CSSProperties }>();

  if (cache.current && isEqual(cache.current.theme, theme)) {
    return cache.current.styles;
  }

  const styles = isString(theme)
    ? PRESET_STYLES[theme]
    : mapTokensToStyles(resolveTheme(theme).tokens);

  cache.current = { theme, styles };

  return styles;
};
