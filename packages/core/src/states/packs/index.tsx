/**
 * @jsxImportSource functive
 */

import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@fluxdown/types';
import type { ElementContent, Parent } from 'hast';

import { Shad, Smooth } from '@fluxdown/core-presets/mapper';
import { type JSXDescriptor, once, useDefaults, useFlatten, useMap } from 'functive';
import { shallowEqual } from 'shallow-equal';

import type { IRenderPlugin } from '../../externals';
import type { HastRoot } from '../../typings';
import type { MapperPluggable } from '../base';
import type { CoreInputs } from './type';

import { isPluggablesEqual, MapperComposer, PluginBuilder, TextChunker } from '../base';
import { BlockCompiler } from '../hast';
import {
  RawPatchesMapper,
  RehypePluggablesMapper,
  RemarkPluggablesMapper,
  RenderPatchesMapper,
  RepairPluggablesMapper,
} from './states';
import { mergePluginPluggables } from './states/utils';
import { toBaseShadConfig, toBaseSmoothConfig } from './utils';

export * from './consts';
export * from './states';
export * from './type';

export const Core = /*#__PURE__*/ once(function Core<R, C = {}>({
  Renderer,
  text,
  patches,
  build,
  smooth: _smooth,
  shad: _shad,
  renders,
  remarks,
  rehypes,
  repairs,
  mappers: _mappers,
}: CoreInputs<R, C>): JSXDescriptor<R[]> {
  const remarkSources = useDefaults(remarks, []);

  const rehypeSources = useDefaults(rehypes, []);

  const repairSources = useDefaults(repairs, []);

  const smoothSource = useDefaults(_smooth, false);

  const smooth = useMap(smoothSource, toBaseSmoothConfig, shallowEqual);

  const flattenConfig = useFlatten(smooth);

  const shadSource = useDefaults(_shad, false);

  const shad = useMap(shadSource, toBaseShadConfig, shallowEqual);

  const shadConfig = useFlatten(shad);

  const DefaultMappers: MapperPluggable[] = [
    [Smooth<HastRoot>, flattenConfig],
    [Shad, shadConfig],
  ];

  const mappers = useMap(
    useDefaults(_mappers, []),
    (items) => mergePluginPluggables(DefaultMappers, items),
    isPluggablesEqual,
  );

  return (
    <Renderer
      patches={<RenderPatchesMapper<R> patches={patches} />}
      plugins={<PluginBuilder<IRenderPlugin<ElementContent, Parent, R, C>> plugins={renders} />}
      source={
        <MapperComposer
          mappers={mappers}
          source={
            <BlockCompiler
              sections={
                <TextChunker text={text} patches={<RawPatchesMapper<R> patches={patches} />} />
              }
              config={build}
              getRemarks={({ config }) => (
                <PluginBuilder<IRemarkPlugin>
                  plugins={
                    <RemarkPluggablesMapper
                      config={config}
                      extras={remarkSources}
                      repairs={
                        <PluginBuilder<IRepairPlugin>
                          plugins={
                            <RepairPluggablesMapper config={config} extras={repairSources} />
                          }
                        />
                      }
                    />
                  }
                />
              )}
              getRehypes={() => (
                <PluginBuilder<IRehypePlugin>
                  plugins={<RehypePluggablesMapper config={build} extras={rehypeSources} />}
                />
              )}
            />
          }
        />
      }
    />
  );
});
