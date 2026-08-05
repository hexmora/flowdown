import type { Code, Root } from 'mdast';

import { describe, expect, test } from 'vitest';

import { RawParserRehypePlugin, SanitizerRehypePlugin } from '../../rehype';
import { CodeMetaRemarkPlugin } from '../index';
import { findHastElement, markdownToHast, runRemarkPlugin } from './utils';

describe('CodeMetaRemarkPlugin', () => {
  test('preserves fenced-code metadata through raw parsing and sanitization', () => {
    const tree = markdownToHast({
      text: ['```html type="renderer"', '<div></div>', '```'].join('\n'),
      remarks: [new CodeMetaRemarkPlugin()],
      rehypes: [new RawParserRehypePlugin(), new SanitizerRehypePlugin({ allowedTags: [] })],
    });
    const code = findHastElement(tree, 'code');

    expect(code?.properties).toMatchObject({
      className: ['language-html'],
      dataMeta: 'type="renderer"',
    });
  });

  test('merges existing node data and HAST properties without parsing metadata', () => {
    const code: Code = {
      type: 'code',
      lang: 'ts',
      meta: 'flag key="value"',
      value: 'const value = 1;',
      data: {
        stable: true,
        hProperties: { title: 'Existing', dataMeta: 'stale' },
      },
    };
    const tree: Root = { type: 'root', children: [code] };

    runRemarkPlugin(tree, new CodeMetaRemarkPlugin());

    expect(code.data).toMatchObject({
      stable: true,
      hProperties: {
        title: 'Existing',
        dataMeta: 'flag key="value"',
      },
    });
  });

  test('does not add data to code blocks without metadata', () => {
    const code: Code = { type: 'code', lang: null, meta: null, value: 'plain' };
    const tree: Root = { type: 'root', children: [code] };

    runRemarkPlugin(tree, new CodeMetaRemarkPlugin());

    expect(code.data).toBeUndefined();
  });
});
