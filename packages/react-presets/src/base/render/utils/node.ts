import type { Element, ElementContent } from 'hast';

export const isElementWithTag = <T extends string>(
  node: ElementContent,
  ...tagNames: readonly T[]
): node is Element & { tagName: T } =>
  node.type === 'element' && tagNames.some((tagName) => tagName === node.tagName);

export const getTextContent = (node: ElementContent): string => {
  if (node.type === 'text') {
    return node.value;
  }

  if (node.type !== 'element') {
    return '';
  }

  return node.children
    .map((child) =>
      child.type === 'text' || child.type === 'element' ? getTextContent(child) : '',
    )
    .join('');
};
