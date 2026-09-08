import type { CSSProperties } from 'react';

import { PREFIX } from '@flowdown/react-presets/base';
import { forOwn, isArray, isObject, isString, merge, replace, toLower, toString } from 'lodash-es';

import type { PartialThemeConfig, PresetKeys, Theme, ThemeConfig, ThemeTokens } from '../types';

import { PRESET_THEME_MAP } from './presets';

const isThemeTuple = (theme: Theme): theme is [PresetKeys, PartialThemeConfig] => isArray(theme);

export const resolveTheme = (theme: Theme = 'light'): ThemeConfig => {
  if (isString(theme)) {
    return PRESET_THEME_MAP[theme];
  }

  const [preset, overrides]: [PresetKeys, PartialThemeConfig] = isThemeTuple(theme)
    ? theme
    : ['light', theme];

  return merge({}, PRESET_THEME_MAP[preset], overrides);
};

export const mapTokensToStyles = (tokens: ThemeTokens): CSSProperties => {
  const styles: Record<string, string> = {};

  const visit = (value: object, path: string) => {
    forOwn(value, (token: unknown, key) => {
      const name = `${path}-${replace(key, /[A-Z]/g, (letter) => `-${toLower(letter)}`)}`;

      if (isObject(token)) {
        visit(token, name);
      } else {
        styles[name] = toString(token);
      }
    });
  };

  visit(tokens, `--${PREFIX}`);

  return styles as CSSProperties;
};
