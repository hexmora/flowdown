/**
 * @jsxImportSource reactive
 */

import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { type JSXDescriptor, once, useDefaults } from 'reactive';

import type { IRenderPlugin } from '../../externals';
import type { CoreInputs } from './type';

import { MapperComposer, PluginBuilder, TextChunker } from '../base';
import { BlockCompiler } from '../hast';
import {
  MapperPluggables,
  RawPatchesMapper,
  RehypePluggables,
  RemarkPluggables,
  RenderPatchesMapper,
  RenderPluggables,
  RepairPluggables,
} from './states';

export * from './states';
export * from './type';

export const Core = /*#__PURE__*/ once(function Core<R, C = {}>({
  Renderer,
  text,
  patches,
  build,
  renders,
  remarks,
  rehypes,
  repairs,
  mappers,
}: CoreInputs<R, C>): JSXDescriptor<R[]> {
  const remarkSources = useDefaults(remarks, {});

  const rehypeSources = useDefaults(rehypes, {});

  const repairSources = useDefaults(repairs, {});

  const mapperSources = useDefaults(mappers, {});

  return (
    <Renderer
      patches={<RenderPatchesMapper<R> patches={patches} />}
      plugins={
        <PluginBuilder<IRenderPlugin<ElementContent, Parent, R, C>>
          plugins={<RenderPluggables<ElementContent, Parent, R, C> extras={renders} />}
        />
      }
      source={
        <MapperComposer
          mappers={<MapperPluggables extras={mapperSources} />}
          source={
            <BlockCompiler
              sections={
                <TextChunker text={text} patches={<RawPatchesMapper<R> patches={patches} />} />
              }
              config={build}
              getRemarks={({ config }) => (
                <PluginBuilder<IRemarkPlugin>
                  plugins={
                    <RemarkPluggables
                      config={config}
                      extras={remarkSources}
                      repairs={
                        <PluginBuilder<IRepairPlugin>
                          plugins={<RepairPluggables config={config} extras={repairSources} />}
                        />
                      }
                    />
                  }
                />
              )}
              getRehypes={() => (
                <PluginBuilder<IRehypePlugin>
                  plugins={<RehypePluggables config={build} extras={rehypeSources} />}
                />
              )}
            />
          }
        />
      }
    />
  );
});
