import type { Element, Text } from 'hast';

import { describe, expect, test } from 'vitest';

import type { SlotType } from '../types';

import { PRESET_RENDER_PLUGINS, PRESET_SLOT_PLUGINS } from '../plugins';

const EXPECTED_SLOT_TYPES: SlotType[] = [
  'Blockquote',
  'BreakLine',
  'CodeBlock',
  'CodeHeader',
  'CodeHighlighter',
  'Emphasis',
  'Heading',
  'Image',
  'Link',
  'List',
  'Paragraph',
  'Strong',
  'Table',
  'Tex',
];

const createMath = (tagName: string): Element => ({
  children: [{ type: 'text', value: 'x' }],
  properties: { dataType: 'inline-math' },
  tagName,
  type: 'element',
});

describe('plugin presets', () => {
  test('exports a render preset whose always-match fallback is last', () => {
    const instances = PRESET_RENDER_PLUGINS.map((Plugin) => new Plugin());

    const genericTextNode: Text = { type: 'text', value: 'plain' };

    const matches = instances.filter((plugin) =>
      plugin.match({ node: genericTextNode, parents: [] }),
    );

    expect(instances.length).toBeGreaterThan(1);

    expect(matches).toEqual(instances.slice(-1));
  });

  test('exports slot presets for all business slots but not special policy slots', () => {
    const instances = PRESET_SLOT_PLUGINS.map((Plugin) => new Plugin());

    const types = instances.map((plugin) => plugin.type);

    expect(types).toHaveLength(EXPECTED_SLOT_TYPES.length);

    expect(types.every((type) => EXPECTED_SLOT_TYPES.includes(type))).toBe(true);

    expect(EXPECTED_SLOT_TYPES.every((type) => types.includes(type))).toBe(true);

    expect(types).not.toContain('Fallback');

    expect(types).not.toContain('Wrapper');
  });

  test('matches Tex placeholders only when the placeholder element is a span', () => {
    const instances = PRESET_RENDER_PLUGINS.map((Plugin) => new Plugin());

    const fallback = instances.at(-1);

    const spanMatches = instances.filter((plugin) =>
      plugin.match({ node: createMath('span'), parents: [] }),
    );

    const divMatches = instances.filter((plugin) =>
      plugin.match({ node: createMath('div'), parents: [] }),
    );

    expect(spanMatches).toHaveLength(2);

    expect(spanMatches.at(-1)).toBe(fallback);

    expect(divMatches).toEqual([fallback]);
  });
});
