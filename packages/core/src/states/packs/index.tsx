/**
 * @jsxImportSource reactive
 */

import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { type JSXDescriptor, once, useDefaults, useFlatten, useMap } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { IRenderPlugin } from '../../externals';
import type { HastRoot } from '../../typings';
import type { CoreInputs } from './type';

import { PluginBuilder, Smooth, TextChunker } from '../base';
import { BlockCompiler } from '../hast';
import {
  RawPatchesMapper,
  RehypePluggablesMapper,
  RemarkPluggablesMapper,
  RenderPatchesMapper,
  RepairPluggablesMapper,
} from './states';
import { toBaseSmoothConfig } from './utils';

export * from './consts';
export * from './states';
export * from './type';

export const Core = /*#__PURE__*/ once(function Core<R, C = {}>({
  Renderer,
  text,
  patches,
  build,
  smooth: _smooth,
  renders,
  remarks,
  rehypes,
  repairs,
}: CoreInputs<R, C>): JSXDescriptor<R[]> {
  const remarkSources = useDefaults(remarks, []);

  const rehypeSources = useDefaults(rehypes, []);

  const repairSources = useDefaults(repairs, []);

  const smoothSource = useDefaults(_smooth, false);

  const smooth = useMap(smoothSource, toBaseSmoothConfig, shallowEqual);

  const flattenConfig = useFlatten(smooth);

  return (
    <Renderer
      patches={<RenderPatchesMapper<R> patches={patches} />}
      plugins={<PluginBuilder<IRenderPlugin<ElementContent, Parent, R, C>> plugins={renders} />}
      source={
        <Smooth<HastRoot>
          {...flattenConfig}
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
