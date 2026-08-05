import type { SyntaxHtmlAllowedRemarkPluginConfig } from './index';

import { DEFAULT_ENABLED_TAGS, HTML_END_TAG_PATTERN, HTML_START_TAG_PATTERN } from './consts';

export const getTagName = (value: string): string | undefined => {
  const startTag = HTML_START_TAG_PATTERN.exec(value);
  const endTag = HTML_END_TAG_PATTERN.exec(value);
  const tagName = startTag?.[1] ?? endTag?.[1];

  return tagName?.toLowerCase();
};

export const isEnabledTag = (
  tagName: string,
  enabledTags: SyntaxHtmlAllowedRemarkPluginConfig['enabledTags'],
) => {
  if (typeof enabledTags === 'boolean') {
    return enabledTags;
  }

  return DEFAULT_ENABLED_TAGS.includes(tagName) || enabledTags?.includes(tagName) === true;
};
