import type { IRehypePlugin, IRemarkPlugin } from '@flowdown/types';
import type { Nodes as HastNode } from 'hast';
import type { Root, RootContent } from 'mdast';

import { isArray, toPairs } from 'lodash-es';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { type Processor, unified } from 'unified';

import type { HastRoot, MdastRoot } from '../../typings';

type AstProcessor = Processor<MdastRoot, undefined, undefined, undefined, undefined>;

type HastProcessor = Processor<MdastRoot, MdastRoot, HastRoot, undefined, undefined>;

export interface GetAstProcessorByPluginsParams {
  remarks?: IRemarkPlugin[];
}

export const getAstProcessorByPlugins = ({ remarks = [] }: GetAstProcessorByPluginsParams) => {
  let processor: AstProcessor = unified().use(remarkParse);

  for (const remark of remarks) {
    processor = processor.use(remark.plugin) as unknown as AstProcessor;
  }

  return processor;
};

interface GetHastProcessorParams {
  remarks?: IRemarkPlugin[];

  rehypes?: IRehypePlugin[];
}

const getHastProcessor = ({ remarks = [], rehypes = [] }: GetHastProcessorParams) => {
  let processor: AstProcessor | HastProcessor = getAstProcessorByPlugins({ remarks });

  processor = processor.use(remarkRehype, { allowDangerousHtml: true });

  for (const rehype of rehypes) {
    processor = processor.use(rehype.plugin);
  }

  return processor;
};

export type MarkdownToHastParams = {
  text: string;

  remarks?: IRemarkPlugin[];

  rehypes?: IRehypePlugin[];
};

export const markdownToHast = ({ text, remarks, rehypes }: MarkdownToHastParams): HastRoot => {
  const processor = getHastProcessor({ remarks, rehypes });
  const mdast = processor.parse(text);

  return processor.runSync(mdast, text);
};

export type MdastNode = Root | RootContent;

export const parseMarkdown = (text: string, remarks: IRemarkPlugin[] = []): Root => {
  const processor = getAstProcessorByPlugins({ remarks });

  return processor.runSync(processor.parse(text), text) as Root;
};

export const runRemarkPlugin = <T extends MdastNode>(node: T, plugin: IRemarkPlugin): T => {
  return unified()
    .use(plugin.plugin)
    .runSync(node as Root) as T;
};

export const walkMdast = (root: MdastNode, visit: (node: MdastNode) => void): void => {
  const pending: MdastNode[] = [root];

  while (pending.length > 0) {
    const node = pending.pop();

    if (!node) {
      continue;
    }

    visit(node);

    if ('children' in node && isArray(node.children)) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        const child = node.children[index];

        if (child) {
          pending.push(child);
        }
      }
    }
  }
};

export const collectTextValues = (root: MdastNode): string[] => {
  const values: string[] = [];

  walkMdast(root, (node) => {
    if (node.type === 'text') {
      values.push(node.value);
    }
  });

  return values;
};

export const findHastElement = (
  root: HastNode,
  tagName: string,
): Extract<HastNode, { type: 'element' }> | undefined => {
  const pending: HastNode[] = [root];

  while (pending.length > 0) {
    const node = pending.pop();

    if (!node) {
      continue;
    }

    if (node.type === 'element' && node.tagName === tagName) {
      return node;
    }

    if ('children' in node) {
      pending.push(...node.children);
    }
  }

  return undefined;
};

export const stripPositions = <T>(value: T): T => {
  if (isArray(value)) {
    return value.map((item) => stripPositions(item)) as unknown as T;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, item] of toPairs(value)) {
    if (key !== 'position') {
      result[key] = stripPositions(item);
    }
  }

  return result as T;
};
