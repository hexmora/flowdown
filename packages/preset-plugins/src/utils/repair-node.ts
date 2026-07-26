import type { Parent, RootContent } from 'mdast';

export const isRepairNodeType = <T extends RootContent['type']>(
  node: Parent | RootContent,
  type: T,
): node is Extract<RootContent, { type: T }> => {
  return node.type === type;
};
