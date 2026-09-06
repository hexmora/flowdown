/** @jsxImportSource reactive */

import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { type JSXDescriptor, once, useDefaults } from 'reactive';

import type { IRenderPlugin } from '../../externals';
import type { CoreInputs } from './type';

import { PluginBuilder, TextChunker } from '../base';
import { BlockCompiler } from '../hast';
import {
  RawPatchesMapper,
  RehypePluggablesMapper,
  RemarkPluggablesMapper,
  RenderPatchesMapper,
  RepairPluggablesMapper,
} from './states';

export * from './states';
export * from './type';

export const Core = /*#__PURE__*/ once(function Core<R, C = {}>({
  Renderer,
  text,
  patches,
  config: coreConfig,
  renders,
  remarks,
  rehypes,
  repairs,
}: CoreInputs<R, C>): JSXDescriptor<R[]> {
  const remarkSources = useDefaults(remarks, []);

  const rehypeSources = useDefaults(rehypes, []);

  const repairSources = useDefaults(repairs, []);

  return (
    <Renderer
      patches={<RenderPatchesMapper<R> patches={patches} />}
      plugins={<PluginBuilder<IRenderPlugin<ElementContent, Parent, R, C>> plugins={renders} />}
      source={
        <BlockCompiler
          sections={<TextChunker text={text} patches={<RawPatchesMapper<R> patches={patches} />} />}
          config={coreConfig}
          getRemarks={({ config }) => (
            <PluginBuilder<IRemarkPlugin>
              plugins={
                <RemarkPluggablesMapper
                  config={config}
                  extras={remarkSources}
                  repairs={
                    <PluginBuilder<IRepairPlugin>
                      plugins={<RepairPluggablesMapper config={config} extras={repairSources} />}
                    />
                  }
                />
              }
            />
          )}
          getRehypes={() => (
            <PluginBuilder<IRehypePlugin>
              plugins={<RehypePluggablesMapper config={coreConfig} extras={rehypeSources} />}
            />
          )}
        />
      }
    />
  );
});
