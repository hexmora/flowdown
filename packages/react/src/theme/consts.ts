import { mapValues } from 'lodash-es';

import { PRESET_THEME_MAP } from './presets';
import { mapTokensToStyles } from './utils';

export const PRESET_STYLES = /*#__PURE__*/ mapValues(PRESET_THEME_MAP, ({ tokens }) =>
  mapTokensToStyles(tokens),
);
