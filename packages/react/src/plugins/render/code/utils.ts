import type { Element } from 'hast';

import { isString } from 'lodash-es';

import { getStringProperty, getTextContent, isElementWithTag } from '../base/utils';

export const getCodeElement = (node: Element) =>
  node.children.find((child): child is Element => isElementWithTag(child, 'code'));

const getClassNames = (node: Element | undefined) => {
  const value = node?.properties?.className;

  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(/\s+/));
  }

  return isString(value) ? value.split(/\s+/) : [];
};

export const getLanguage = (pre: Element, code: Element | undefined) => {
  const explicit =
    getStringProperty(code?.properties?.dataLanguage) ??
    getStringProperty(pre.properties?.dataLanguage);

  if (explicit) {
    return explicit;
  }

  for (const className of [...getClassNames(code), ...getClassNames(pre)]) {
    const match = /^(?:lang|language)-(.+)$/.exec(className);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
};

export const getMeta = (pre: Element, code: Element | undefined) => {
  const codeMeta = code?.data && 'meta' in code.data ? code.data.meta : undefined;

  const preMeta = pre.data && 'meta' in pre.data ? pre.data.meta : undefined;

  const meta =
    getStringProperty(code?.properties?.dataMeta) ??
    getStringProperty(pre.properties?.dataMeta) ??
    getStringProperty(codeMeta) ??
    getStringProperty(preMeta);

  if (!meta) {
    return undefined;
  }

  const publicMeta = meta
    .split(/\s+/)
    .filter((token) => token && !token.startsWith('__'))
    .join(' ');

  return publicMeta || undefined;
};

export const getCode = (pre: Element, code: Element | undefined) =>
  getTextContent(code ?? pre).replace(/\r?\n$/, '');
