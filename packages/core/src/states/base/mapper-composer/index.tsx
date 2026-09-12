/**
 * @jsxImportSource functive
 */

import type { IBlockState } from '@fluxdown/types';

import { PluginPriority } from '@fluxdown/types';
import { D, type IReadableClosure, type JSXDescriptor, once, useMap, useSwitchMap } from 'functive';
import { first, isArray, sortBy, tail } from 'lodash-es';

import type { HastRoot } from '../../../typings';
import type { Mapper, MapperComposerInputs, MapperPluggable } from './type';

import { isPluggableEqual, isPluggablesEqual } from '../plugin-builder';

export * from './type';

const MapperItem = /*#__PURE__*/ once(function MapperItem({
  mapper,
  mappers,
  source,
}: MapperComposerInputs & { mapper: [Mapper, object | undefined] }): JSXDescriptor<
  IBlockState<HastRoot>[]
> {
  const [Mapper, config] = mapper;

  // Freeze the old suffix while its mapper is being replaced.
  const rest = useMap(mappers, (items, previous): MapperPluggable[] =>
    isPluggableEqual(first(items), mapper) ? tail(items) : (previous?.[1] ?? []),
  );

  return <MapperComposer mappers={rest} source={Mapper({ ...config, source })} />;
});

export const MapperComposer = /*#__PURE__*/ once(function MapperComposer({
  mappers: _mappers,
  source,
}: MapperComposerInputs): IReadableClosure<IBlockState<HastRoot>[]> {
  const mappers = useMap(
    _mappers,
    (items) =>
      sortBy(items, (item) =>
        isArray(item) ? (item[1].priority ?? PluginPriority.Default) : PluginPriority.Default,
      ),
    isPluggablesEqual,
  );

  const current = useMap(mappers, (items) => first(items), isPluggableEqual);

  return useSwitchMap(current, (pluggable) => {
    if (!pluggable) {
      return source;
    }

    const mapper: [Mapper, object | undefined] = isArray(pluggable)
      ? pluggable
      : [pluggable, undefined];

    return <MapperItem mapper={D(mapper)} mappers={mappers} source={source} />;
  });
});
