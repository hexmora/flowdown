import type { IRepairPlugin } from '@flowdown/types';
import type { Parent, Root, RootContent } from 'mdast';

import { cloneDeep, isArray } from 'lodash-es';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';

import { processRepairByPlugins } from '../../utils/repair-runner';

export interface RunRepairsOptions {
  ending?: boolean;
  safe?: boolean;
}

export const runRepairs = <T extends Parent | RootContent>(
  node: T,
  plugins: IRepairPlugin | IRepairPlugin[],
  options: RunRepairsOptions = {},
): T => {
  const result = cloneDeep(node);

  processRepairByPlugins({
    node: result,
    plugins: isArray(plugins) ? plugins : [plugins],
    ending: options.ending ?? true,
    safe: options.safe,
  });

  return result;
};

export const repairMarkdown = (
  source: string,
  plugins: IRepairPlugin | IRepairPlugin[],
  options: RunRepairsOptions = {},
): Root => {
  return runRepairs(fromMarkdown(source), plugins, options);
};

export const stringifyMarkdown = (tree: Root): string => {
  return toMarkdown(tree).trim();
};

export const root = (children: RootContent[]): Root => ({
  type: 'root',
  children,
});

export const paragraph = (
  children: Extract<RootContent, { type: 'paragraph' }>['children'],
): Extract<RootContent, { type: 'paragraph' }> => ({
  type: 'paragraph',
  children,
});
