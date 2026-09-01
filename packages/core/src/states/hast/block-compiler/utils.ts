import type { IRehypePlugin, IRemarkPlugin } from '@flowdown/types';
import type { IDestructible } from 'reactive';

import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { Processor, unified } from 'unified';

import { HastRoot, MdastRoot } from '../../../typings';

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
  let processor: AstProcessor | HastProcessor = getAstProcessorByPlugins({
    remarks,
  });

  processor = processor.use(remarkRehype, {
    allowDangerousHtml: true,
  });

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

export const destroyAll = (items: readonly IDestructible[]) => {
  for (const item of items) {
    item.destroy();
  }
};
