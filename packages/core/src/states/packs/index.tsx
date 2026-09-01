/** @jsxImportSource reactive */

import type { IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';

import { D, immediate, type JSXDescriptor } from 'reactive';

import type { IRenderPlugin } from '../../externals';
import type { CoreStateClosureInputs } from './type';

import { PluginBuilderStateClosure, TextChunkerStateClosure } from '../base';
import { BlockCompilerStateClosure } from '../hast';
import {
  RawPatchesMapper,
  RehypePluggablesMapper,
  RemarkPluggablesMapper,
  RenderPatchesMapper,
  RepairPluggablesMapper,
} from './states';

export * from './states';
export * from './type';
export * from './utils';

export const CoreStateClosure = /*#__PURE__*/ immediate(function CoreStateClosure<R, C = {}>({
  Renderer,
  text,
  patches,
  config,
  renders,
  remarks,
  rehypes,
  repairs,
}: CoreStateClosureInputs<R, C>): JSXDescriptor<R[]> {
  const remarkSources = remarks ?? [];

  const rehypeSources = rehypes ?? [];

  const repairSources = repairs ?? [];

  return (
    <Renderer
      patches={<RenderPatchesMapper<R> patches={patches} />}
      plugins={
        <PluginBuilderStateClosure<IRenderPlugin<ElementContent, Parent, R, C>> plugins={renders} />
      }
      source={
        <BlockCompilerStateClosure
          sections={
            <TextChunkerStateClosure
              text={D(text)}
              patches={D(<RawPatchesMapper<R> patches={patches} />)}
            />
          }
          config={config}
          getRemarks={(blockConfig) => (
            <PluginBuilderStateClosure<IRemarkPlugin>
              plugins={
                <RemarkPluggablesMapper
                  config={blockConfig}
                  extras={remarkSources}
                  repairs={
                    <PluginBuilderStateClosure<IRepairPlugin>
                      plugins={<RepairPluggablesMapper config={config} extras={repairSources} />}
                    />
                  }
                />
              }
            />
          )}
          getRehypes={() => (
            <PluginBuilderStateClosure<IRehypePlugin>
              plugins={<RehypePluggablesMapper config={config} extras={rehypeSources} />}
            />
          )}
        />
      }
    />
  );
});
