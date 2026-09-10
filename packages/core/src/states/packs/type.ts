import type {
  IPluggable,
  IRawPatchRange,
  IRehypePlugin,
  IRemarkPlugin,
  IRepairPlugin,
  PluginSet,
} from '@flowdown/types';
import type { ElementContent, Parent } from 'hast';
import type { IReadableClosure } from 'reactive';

import type { IRenderPatchRender, IRenderPlugin, RendererClass } from '../../externals';
import type { HastRoot } from '../../typings';
import type { MapperPluggable } from '../base';
import type { BlockCompilerConfig } from '../hast';

export interface IPatchItem<R> {
  /**
   * Stable identifier for the patch.
   */
  key?: string;

  /**
   * Source text range replaced by the patch.
   */
  range: IRawPatchRange;

  /**
   * Render the replacement content.
   */
  render: IRenderPatchRender<R>;
}

export type CoreInputs<R, C = {}> = {
  /**
   * Renderer used to turn compiled blocks into output values.
   */
  Renderer: RendererClass<HastRoot, ElementContent, Parent, R, C>;

  /**
   * Markdown source text.
   */
  text: IReadableClosure<string>;

  /**
   * Source ranges and their render replacements.
   */
  patches: IReadableClosure<IPatchItem<R>[]>;

  /**
   * Compiler feature configuration.
   */
  build: IReadableClosure<BlockCompilerConfig>;

  /**
   * Plugins used to render compiled content.
   */
  renders: IReadableClosure<
    PluginSet<IPluggable<IRenderPlugin<ElementContent, Parent, R, C>, unknown>, RenderConfigs>
  >;

  /**
   * Additional Markdown tree plugins or configuration overrides for the presets.
   */
  remarks?: IReadableClosure<PluginSet<IPluggable<IRemarkPlugin, unknown>, RemarkConfigs>>;

  /**
   * Additional HAST plugins or configuration overrides for the presets.
   */
  rehypes?: IReadableClosure<PluginSet<IPluggable<IRehypePlugin, unknown>, RehypeConfigs>>;

  /**
   * Additional streaming Markdown repair plugins or configuration overrides for the presets.
   */
  repairs?: IReadableClosure<PluginSet<IPluggable<IRepairPlugin, unknown>, RepairConfigs>>;

  /**
   * Additional block mappers or configuration overrides for the default mappers.
   */
  mappers?: IReadableClosure<PluginSet<MapperPluggable, MapperConfigs>>;
};
