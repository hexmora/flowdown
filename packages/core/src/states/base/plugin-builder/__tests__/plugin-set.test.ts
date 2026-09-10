import type { IPluggable, IRemarkPlugin, PluginSet } from '@flowdown/types';
import type { IReadableClosure } from 'reactive';

import { PRESET_MAPPER_PLUGINS, Shad, Smooth } from '@flowdown/core-presets/mapper';
import { SyntaxPolicyRemarkPlugin } from '@flowdown/core-presets/remark';
import { PluginPriority } from '@flowdown/types';
import { once, render } from 'reactive';
import { describe, expect, expectTypeOf, test } from 'vitest';

import type { CoreInputs } from '../../../packs';
import type { MapperInputs, MapperPluggable } from '../../mapper-composer';

import { isPluginSetEqual, isPluginSetTuple, toPluggable } from '..';

const acceptMappers = (_plugins: PluginSet<MapperPluggable, MapperConfigs>) => {};

describe('plugin sets', () => {
  test('merges default plugins for lists, configuration maps, and list/configuration tuples', () => {
    const plugins: MapperPluggable[] = [Shad];

    const configs: MapperConfigs = { shad: { enabled: render(true) } };

    expect(toPluggable(plugins, PRESET_MAPPER_PLUGINS)).toEqual([Smooth, Shad]);

    expect(toPluggable<MapperPluggable, MapperConfigs>(configs, PRESET_MAPPER_PLUGINS)).toEqual([
      Smooth,
      [Shad, configs.shad],
    ]);

    expect(
      toPluggable<MapperPluggable, MapperConfigs>([plugins, configs], PRESET_MAPPER_PLUGINS),
    ).toEqual([Smooth, [Shad, configs.shad]]);

    expect(toPluggable([], PRESET_MAPPER_PLUGINS)).toEqual([Smooth, Shad]);

    expect(
      toPluggable<MapperPluggable, MapperConfigs>([[], configs], PRESET_MAPPER_PLUGINS),
    ).toEqual([Smooth, [Shad, configs.shad]]);
  });

  test('distinguishes list/configuration tuples from two configured or mixed plugin entries', () => {
    const shad: MapperPluggable = [Shad, { enabled: render(true) }];

    const smooth: MapperPluggable = [Smooth, { enabled: render(false) }];

    const lists: MapperPluggable[][] = [
      [shad, smooth],
      [shad, Smooth],
      [Shad, smooth],
    ];

    for (const plugins of lists) {
      expect(isPluginSetTuple<MapperPluggable, MapperConfigs>(plugins)).toBe(false);

      expect(toPluggable(plugins)).toEqual(plugins);
    }

    expect(isPluginSetTuple<MapperPluggable, MapperConfigs>([[Shad], {}])).toBe(true);
  });

  test('replaces default entries, deduplicates extras, then applies configuration overrides', () => {
    const Observe = once(function Observe({ source }: MapperInputs) {
      return source;
    });

    const options = { enabled: render(true), length: render(4), priority: PluginPriority.High };

    const replacement: MapperPluggable = [Shad, options];

    const plugins: MapperPluggable[] = [Shad, Observe, replacement, Observe];

    const configs: MapperConfigs = { shad: { length: render(2) } };

    const defaults: MapperPluggable[] = [Smooth, Shad];

    Object.freeze(defaults);

    Object.freeze(plugins);

    Object.freeze(replacement);

    const result = toPluggable<MapperPluggable, MapperConfigs>([plugins, configs], defaults);

    expect(result).toEqual([Smooth, [Shad, { ...options, ...configs.shad }], Observe]);

    expect(defaults).toEqual([Smooth, Shad]);

    expect(plugins).toEqual([Shad, Observe, replacement, Observe]);

    expect(options.length.value.value).toBe(4);
  });

  test('preserves repeated entries when no default plugin list is provided', () => {
    const plugins: MapperPluggable[] = [Shad, [Shad, { enabled: render(true) }]];

    expect(toPluggable(plugins)).toEqual(plugins);

    expect(toPluggable(plugins, [])).toEqual(plugins);
  });

  test('overrides selected options without mutating lists, tuples, or shared configuration', () => {
    const options = Object.freeze({
      enabled: render(true),
      length: render(4),
      priority: PluginPriority.High,
    });

    const configured: MapperPluggable = [Shad, options];

    const plugins: MapperPluggable[] = [Smooth, configured];

    const configs: MapperConfigs = { shad: { enabled: render(false) } };

    Object.freeze(configured);

    Object.freeze(plugins);

    Object.freeze(configs);

    const result = toPluggable<MapperPluggable, MapperConfigs>([plugins, configs]);

    expect(result).toEqual([Smooth, [Shad, { ...options, ...configs.shad }]]);

    expect(result).not.toBe(plugins);

    expect(result[0]).toBe(Smooth);

    expect(result[1]).not.toBe(configured);

    expect(plugins).toEqual([Smooth, [Shad, options]]);

    expect(options.enabled.value.value).toBe(true);
  });

  test('matches class configuration by static key and leaves absent plugins out', () => {
    const plugins: IPluggable<IRemarkPlugin, unknown>[] = [SyntaxPolicyRemarkPlugin];

    const configs: RemarkConfigs = {
      'remark-syntax-policy': { indentedCode: true },
      'remark-syntax-footnote': { priority: PluginPriority.Low },
    };

    expect(toPluggable(configs, plugins)).toEqual([
      [SyntaxPolicyRemarkPlugin, { indentedCode: true }],
    ]);
  });

  test('uses the lowercase name of a once mapper and replaces nested options shallowly', () => {
    const NamedMapper = once(function NamedMapper({ source }: MapperInputs) {
      return source;
    });

    const options = { nested: { first: true, second: true }, priority: PluginPriority.High };

    const plugins: MapperPluggable[] = [[NamedMapper, options]];

    const configs = { namedmapper: { nested: { first: false } } };

    expect(toPluggable([plugins, configs])).toEqual([
      [NamedMapper, { nested: { first: false }, priority: PluginPriority.High }],
    ]);

    expect(options.nested).toEqual({ first: true, second: true });
  });

  test('preserves reactive configuration identity when comparing plugin sets', () => {
    const enabled = render(true);

    expect(
      isPluginSetEqual<MapperPluggable, MapperConfigs>(
        { shad: { enabled } },
        { shad: { enabled } },
      ),
    ).toBe(true);

    expect(
      isPluginSetEqual<MapperPluggable, MapperConfigs>(
        [[Shad], { shad: { enabled } }],
        [[Shad], { shad: { enabled: render(true) } }],
      ),
    ).toBe(false);
  });

  test('keeps the public forms and distributed configuration types strict', () => {
    expectTypeOf<PluginSet<MapperPluggable, MapperConfigs>>().toEqualTypeOf<
      [MapperPluggable[], MapperConfigs] | MapperConfigs | MapperPluggable[]
    >();

    expectTypeOf<CoreInputs<string>['mappers']>().toEqualTypeOf<
      IReadableClosure<PluginSet<MapperPluggable, MapperConfigs>> | undefined
    >();

    const plugins: MapperPluggable[] = [Shad];

    const configs: MapperConfigs = { shad: { enabled: render(true) } };

    const result = toPluggable<MapperPluggable, MapperConfigs>([plugins, configs]);

    expectTypeOf(result).toEqualTypeOf<MapperPluggable[]>();

    acceptMappers(plugins);

    acceptMappers(configs);

    acceptMappers([plugins, configs]);

    // @ts-expect-error Mapper configuration uses declared lowercase plugin names.
    acceptMappers({ Smooth: {} });

    // @ts-expect-error Core mapper options require reactive values.
    acceptMappers({ smooth: { enabled: true } });

    // @ts-expect-error A list/configuration pair cannot omit its explicit plugin list.
    acceptMappers([undefined, configs]);
  });

  test('infers configurable pluggables from bare plugin classes and mapper functions', () => {
    const remarks = toPluggable({ 'remark-syntax-policy': { indentedCode: true } }, [
      SyntaxPolicyRemarkPlugin,
    ]);

    const mappers = toPluggable({ shad: { enabled: render(true) } }, [Shad]);

    expectTypeOf(remarks).toEqualTypeOf<IPluggable<SyntaxPolicyRemarkPlugin, unknown>[]>();

    expectTypeOf(mappers).toEqualTypeOf<MapperPluggable[]>();

    expect(remarks).toEqual([[SyntaxPolicyRemarkPlugin, { indentedCode: true }]]);

    expect(mappers).toEqual([[Shad, { enabled: expect.anything() }]]);
  });
});
