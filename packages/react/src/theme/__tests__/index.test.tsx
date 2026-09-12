import { PREFIX } from '@fluxdown/react-presets/base';
import { render, renderHook } from '@testing-library/react';
import { expectTypeOf } from 'expect-type';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { FluxdownRef, PartialThemeConfig, Theme, ThemeConfig } from '../..';

import { useThemeStyles } from '..';
import { Fluxdown } from '../..';
import { PRESET_THEME_MAP } from '../presets';
import { mapTokensToStyles, resolveTheme } from '../utils';

const token = (name: string) => `--${PREFIX}-${name}`;

describe('themes', () => {
  test('accepts strict deep partial configurations and mutable preset tuples', () => {
    const partial = {
      tokens: { heading: { h1: { fontSize: '2.25rem' } } },
    } satisfies PartialThemeConfig;
    const tuple = ['dark', partial] satisfies Theme;

    expectTypeOf<ThemeConfig>().toExtend<Theme>();
    expectTypeOf<typeof tuple>().toExtend<['dark', PartialThemeConfig]>();
    expectTypeOf<{ tokens: { typo: string } }>().not.toExtend<PartialThemeConfig>();
    expectTypeOf<{
      tokens: { heading: { h1: { fontWeight: string } } };
    }>().not.toExtend<PartialThemeConfig>();
    expect(resolveTheme(tuple).tokens.heading.h1.fontSize).toBe('2.25rem');
  });

  test('merges individual leaves into light without modifying either preset or input', () => {
    const before = structuredClone(PRESET_THEME_MAP);
    const overrides = { tokens: { heading: { h2: { fontWeight: 800 } } } };
    const resolved = resolveTheme(overrides);

    expect(resolved.tokens.heading.h2).toEqual({
      ...PRESET_THEME_MAP.light.tokens.heading.h2,
      fontWeight: 800,
    });
    expect(resolved.tokens.colors).toEqual(PRESET_THEME_MAP.light.tokens.colors);
    expect(PRESET_THEME_MAP).toEqual(before);
    expect(overrides).toEqual({ tokens: { heading: { h2: { fontWeight: 800 } } } });
    resolved.tokens.heading.h1.fontSize = '10rem';
    expect(PRESET_THEME_MAP).toEqual(before);
  });

  test('merges tuple overrides into dark and keeps omitted siblings', () => {
    const resolved = resolveTheme(['dark', { tokens: { colors: { accent: '#c4b5fd' } } }]);

    expect(resolved.tokens.colors).toEqual({
      ...PRESET_THEME_MAP.dark.tokens.colors,
      accent: '#c4b5fd',
    });
    expect(resolveTheme().tokens).toEqual(PRESET_THEME_MAP.light.tokens);
  });

  test('uses the SCSS prefix and converts nested numeric leaves to CSS tokens', () => {
    const styles = mapTokensToStyles(PRESET_THEME_MAP.light.tokens);

    expect(PREFIX).toBe('fluxdown');
    expect(styles).toMatchObject({
      [token('heading-h1-font-weight')]: '650',
      [token('heading-h1-line-height')]: '1.25',
      [token('typography-font-size-md')]: '1rem',
    });
    expect(Object.keys(styles).every((key) => key.startsWith(`--${PREFIX}-`))).toBe(true);
  });

  test('reuses the style object across equivalent inline configs and unrelated streaming renders', () => {
    const first: Theme = { tokens: { heading: { h1: { fontSize: '3rem' } } } };
    const { result, rerender } = renderHook(
      ({ theme }: { theme: Theme }) => useThemeStyles(theme),
      {
        initialProps: { theme: first as Theme },
      },
    );
    const styles = result.current;

    rerender({ theme: structuredClone(first) });
    expect(result.current).toBe(styles);

    rerender({ theme: 'dark' });
    expect(result.current).not.toBe(styles);
    expect(result.current).toMatchObject({ [token('colors-bg')]: '#212121' });
  });

  test('updates tokens without remounting blocks or rebuilding the core', () => {
    const ref = createRef<FluxdownRef>();
    const view = render(<Fluxdown ref={ref} text="# Heading" />);
    const root = view.container.firstElementChild as HTMLElement;
    const heading = root.firstElementChild;
    const core = ref.current;

    expect(root.style.getPropertyValue(token('colors-bg'))).toBe('#ffffff');
    view.rerender(
      <Fluxdown
        ref={ref}
        text="# Heading"
        theme={['dark', { tokens: { heading: { h1: { fontSize: '3rem' } } } }]}
      />,
    );
    expect(root.style.getPropertyValue(token('colors-bg'))).toBe('#212121');
    expect(root.style.getPropertyValue(token('heading-h1-font-size'))).toBe('3rem');
    expect(root.firstElementChild).toBe(heading);
    expect(ref.current).toBe(core);

    view.rerender(<Fluxdown ref={ref} text="# Heading" theme="light" />);
    expect(root.style.getPropertyValue(token('heading-h1-font-size'))).toBe('2rem');
  });

  test('isolates themes per root and preserves consumer styles', () => {
    const view = render(
      <>
        <Fluxdown style={{ color: 'red' }} text="Light" />
        <Fluxdown text="Dark" theme="dark" />
      </>,
    );
    const [light, dark] = Array.from(view.container.children) as HTMLElement[];

    expect(light.style.color).toBe('red');
    expect(light.style.getPropertyValue(token('colors-bg'))).toBe('#ffffff');
    expect(dark.style.getPropertyValue(token('colors-bg'))).toBe('#212121');
  });

  test('includes preset tokens during server rendering', () => {
    const markup = renderToStaticMarkup(<Fluxdown text="# Server" theme="dark" />);

    expect(markup).toContain(`${token('colors-bg')}:#212121`);
    expect(markup).toContain(`${token('heading-h1-font-size')}:2rem`);
  });
});
