import type { IRemarkPlugin } from '@flowdown/types';

import { last } from 'lodash-es';
import remarkParse from 'remark-parse';
import { type Data, unified } from 'unified';
import { describe, expect, test } from 'vitest';

import {
  SyntaxAutolinkRemarkPlugin,
  SyntaxFootnoteRemarkPlugin,
  SyntaxPolicyRemarkPlugin,
  SyntaxStrikethroughRemarkPlugin,
  SyntaxTableRemarkPlugin,
  SyntaxTaskListRemarkPlugin,
} from '../index';

type RemarkExtensionData = Data & {
  micromarkExtensions?: unknown[];
  fromMarkdownExtensions?: unknown[];
  toMarkdownExtensions?: unknown[];
};

describe('remark extension registration', () => {
  test('appends every syntax extension and an empty parser policy without replacing existing data', () => {
    const processor = unified().use(remarkParse);
    const data = processor.data() as RemarkExtensionData;
    const existingMicromark = { existing: 'micromark' };
    const existingFromMarkdown = { existing: 'from-markdown' };
    const existingToMarkdown = { existing: 'to-markdown' };

    data.micromarkExtensions = [existingMicromark];
    data.fromMarkdownExtensions = [existingFromMarkdown];
    data.toMarkdownExtensions = [existingToMarkdown];

    const syntaxAdapters: IRemarkPlugin[] = [
      new SyntaxAutolinkRemarkPlugin(),
      new SyntaxFootnoteRemarkPlugin(),
      new SyntaxStrikethroughRemarkPlugin(),
      new SyntaxTableRemarkPlugin(),
      new SyntaxTaskListRemarkPlugin(),
    ];

    for (const adapter of syntaxAdapters) {
      processor.use(adapter.plugin);
    }

    processor.use(
      new SyntaxPolicyRemarkPlugin({
        indentedCode: true,
        setextHeading: true,
      }).plugin,
    );
    processor.freeze();

    expect(data.micromarkExtensions?.[0]).toBe(existingMicromark);
    expect(data.fromMarkdownExtensions?.[0]).toBe(existingFromMarkdown);
    expect(data.toMarkdownExtensions?.[0]).toBe(existingToMarkdown);
    expect(data.micromarkExtensions).toHaveLength(7);
    expect(data.fromMarkdownExtensions).toHaveLength(6);
    expect(data.toMarkdownExtensions).toHaveLength(6);
    expect(last(data.micromarkExtensions)).toMatchObject({
      disable: { null: [] },
    });
  });
});
