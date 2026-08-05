import type { Element, Nodes } from 'hast';

import { cloneDeep } from 'lodash-es';
import { describe, expect, test } from 'vitest';

import type { SanitizationSchema } from '../../typings';

import { PatchesRemarkPlugin, SyntaxMathRemarkPlugin } from '../../remark';
import { markdownToHast } from '../../remark/__tests__/utils';
import {
  RawParserRehypePlugin,
  SanitizerRehypePlugin,
  type SanitizerRehypePluginConfig,
} from '../index';
import { createSchema } from '../sanitizer/utils';

const findElement = (root: Nodes, tagName: string): Element | undefined => {
  const pending: Nodes[] = [root];

  while (pending.length > 0) {
    const node = pending.shift();

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

const buildSchema = (config: SanitizerRehypePluginConfig = {}): SanitizationSchema => {
  return createSchema(config);
};

const sanitizeMarkdown = (text: string, config: SanitizerRehypePluginConfig = {}) => {
  return markdownToHast({
    text,
    rehypes: [new RawParserRehypePlugin(), new SanitizerRehypePlugin(config)],
  });
};

describe('SanitizerRehypePlugin', () => {
  test('snapshots schema options at construction', () => {
    const allowedTags: string[] = [];
    const plugin = new SanitizerRehypePlugin({ allowedTags });

    allowedTags.push('blink');

    const root = markdownToHast({
      text: '<blink>content</blink>',
      rehypes: [new RawParserRehypePlugin(), plugin],
    });

    expect(findElement(root, 'blink')).toBeUndefined();
  });

  test('preserves inline-math metadata and text', () => {
    const root = markdownToHast({
      text: '$1+1=2$',
      remarks: [new SyntaxMathRemarkPlugin()],
      rehypes: [new SanitizerRehypePlugin({ allowedTags: [] })],
    });
    const span = findElement(root, 'span');

    expect(span?.properties).toMatchObject({ dataType: 'inline-math' });
    expect(span?.children).toEqual([
      expect.objectContaining({
        type: 'text',
        value: '1+1=2',
      }),
    ]);
  });

  test('preserves parser-patch metadata and replaced text', () => {
    const root = markdownToHast({
      text: 'hello',
      remarks: [
        new PatchesRemarkPlugin({
          patches: [{ key: 'middle', range: [1, 4] }],
        }),
      ],
      rehypes: [new SanitizerRehypePlugin({ allowedTags: [] })],
    });
    const span = findElement(root, 'span');

    expect(span?.properties).toMatchObject({
      dataParserPatch: '1',
      dataParserKey: 'middle',
      dataParserText: 'ell',
    });
  });

  test('allows dataType on span elements', () => {
    const schema = buildSchema({ allowedTags: [] });

    expect(schema.attributes?.span).toContain('dataType');
  });

  test('extends the href protocol allowlist', () => {
    const schema = buildSchema({
      allowedTags: [],
      allowedProtocols: ['first'],
    });

    expect(schema.protocols?.href).toContain('first');
    expect(schema.protocols?.href).not.toContain('');
  });

  test('preserves href and title on links', () => {
    const root = sanitizeMarkdown('[link](https://example.com "Example")', {
      allowedTags: [],
    });

    expect(findElement(root, 'a')?.properties).toMatchObject({
      href: 'https://example.com',
      title: 'Example',
    });
  });

  test('removes hrefs with an unlisted custom protocol', () => {
    const root = sanitizeMarkdown('[link](first://quick-open/abc "Example")', {
      allowedTags: [],
    });
    const link = findElement(root, 'a');

    expect(link).toBeDefined();
    expect(link?.properties).not.toHaveProperty('href');
    expect(link?.properties).toMatchObject({ title: 'Example' });
  });

  test('preserves hrefs with an explicitly allowed protocol', () => {
    const root = sanitizeMarkdown('[link](first://quick-open/abc "Example")', {
      allowedTags: [],
      allowedProtocols: ['first'],
    });

    expect(findElement(root, 'a')?.properties).toMatchObject({
      href: 'first://quick-open/abc',
      title: 'Example',
    });
  });

  test('allows fenced-code metadata', () => {
    const schema = buildSchema({ allowedTags: [] });

    expect(schema.attributes?.code).toContain('dataMeta');
  });

  test('preserves data-image sources on raw HTML images', () => {
    const root = sanitizeMarkdown(
      '<img src="data:image/png;base64,AA==" alt="x" title="Example" />',
      { allowedTags: [] },
    );

    expect(findElement(root, 'img')?.properties).toMatchObject({
      src: 'data:image/png;base64,AA==',
      alt: 'x',
      title: 'Example',
    });
  });

  test('merges required additions without mutating a custom baseline', () => {
    const fallback: SanitizationSchema = {
      tagNames: ['custom', 'span'],
      attributes: {
        custom: ['dataToken'],
        span: ['title', 'dataType'],
      },
      protocols: {
        cite: ['https'],
        href: ['first'],
        src: ['https'],
      },
      clobberPrefix: 'safe-',
    };
    const original = cloneDeep(fallback);

    const schema = buildSchema({
      fallback,
      allowedTags: ['custom', 'mark', 'mark'],
      allowedProtocols: ['first', 'second', 'second'],
    });

    expect(schema).not.toBe(fallback);
    expect(schema.tagNames).toEqual(['custom', 'span', 'u', 'br', 'a', 'em', 'mark']);
    expect(schema.attributes).toMatchObject({
      custom: ['dataToken'],
      span: [
        'title',
        'dataType',
        'dataParserPatch',
        'dataParserKey',
        'dataParserText',
        'style',
        'className',
      ],
      a: ['href', 'title'],
      code: ['dataMeta'],
    });
    expect(schema.protocols).toEqual({
      cite: ['https'],
      href: ['first', 'second'],
      src: ['https', 'data'],
    });
    expect(schema.clobberPrefix).toBe('safe-');
    expect(fallback).toEqual(original);
  });

  test('treats boolean allowedTags as no sanitizer tag extension', () => {
    const fallback: SanitizationSchema = { tagNames: ['custom'] };

    const enabled = buildSchema({ fallback, allowedTags: true });
    const disabled = buildSchema({ fallback, allowedTags: false });

    expect(enabled.tagNames).toEqual(['custom', 'u', 'br', 'a', 'span', 'em']);
    expect(disabled.tagNames).toEqual(enabled.tagNames);
  });

  test('preserves allowed class and style properties from raw HTML', () => {
    const root = sanitizeMarkdown(
      '<span class="formula" style="color: red" data-type="inline-math">1+1</span>',
    );

    expect(findElement(root, 'span')?.properties).toMatchObject({
      className: ['formula'],
      dataType: 'inline-math',
      style: 'color: red',
    });
  });
});
