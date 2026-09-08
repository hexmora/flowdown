import type { Parent, RootContent, RootContentMap } from 'mdast';

export const isRepairNodeType = <T extends keyof RootContentMap>(
  node: Parent | RootContent,
  type: T,
): node is Extract<RootContent, { type: T }> => {
  return node.type === type;
};
