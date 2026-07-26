import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import type { Options as ToMarkdownExtension } from 'mdast-util-to-markdown';
import type { Extension as MicromarkExtension } from 'micromark-util-types';
import type { Data } from 'unified';

type RemarkExtensionData = Data & {
  micromarkExtensions?: MicromarkExtension[];

  fromMarkdownExtensions?: FromMarkdownExtension[];

  toMarkdownExtensions?: ToMarkdownExtension[];
};

export interface RemarkSyntaxExtensions {
  micromark: MicromarkExtension;

  fromMarkdown: FromMarkdownExtension;

  toMarkdown: ToMarkdownExtension;
}

export const appendMicromarkExtension = (data: Data, extension: MicromarkExtension) => {
  const extensionData: RemarkExtensionData = data;

  (extensionData.micromarkExtensions ??= []).push(extension);
};

export const appendRemarkExtensions = (data: Data, extensions: RemarkSyntaxExtensions) => {
  const extensionData: RemarkExtensionData = data;

  appendMicromarkExtension(extensionData, extensions.micromark);
  (extensionData.fromMarkdownExtensions ??= []).push(extensions.fromMarkdown);
  (extensionData.toMarkdownExtensions ??= []).push(extensions.toMarkdown);
};
