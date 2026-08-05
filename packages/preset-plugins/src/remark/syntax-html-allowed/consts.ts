export const DEFAULT_ENABLED_TAGS = ['span', 'u', 'br', 'em', 'a'];

export const HTML_START_TAG_PATTERN =
  /<([A-Za-z][A-Za-z0-9_-]*)(?:\s+[A-Za-z_-][A-Za-z0-9_-]*=(?:"[^"]*"|'[^']*'))*\s*\/?>/;

export const HTML_END_TAG_PATTERN = /<\/([A-Za-z][A-Za-z0-9_-]*)>/;
