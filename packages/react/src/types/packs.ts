import type {
  BlockCompilerConfig,
  IPatchItem,
  MapperPluggable,
  PluginConfigs,
} from '@flowdown/core';
import type { ShadConfig as CoreShadConfig, SmoothConfig } from '@flowdown/core-presets/mapper';
import type { AnySlotPluggable, IReactRenderPluggable } from '@flowdown/react-presets/base';
import type { IPluggable, IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { CSSProperties, ReactNode } from 'react';
import type { IReadableClosure } from 'reactive';

import type { Theme } from './theme';

export interface IPluginItem {
  config?: PluginConfigs;

  remarks?: IPluggable<IRemarkPlugin, unknown>[];

  rehypes?: IPluggable<IRehypePlugin, unknown>[];

  repairs?: IPluggable<IRepairPlugin, unknown>[];

  mappers?: MapperPluggable[];

  renders?: IReactRenderPluggable[];

  slots?: AnySlotPluggable[];
}

export type FlowdownConfig = Partial<BlockCompilerConfig>;

export interface ShadConfig extends CoreShadConfig {
  /**
   * Width of the trailing mask in pixels. Set to 0 to hide it.
   * @default 15
   */
  maskWidth?: number;
}

export interface FlowdownProps {
  /**
   * Additional class name applied to the rendered root.
   */
  className?: string;

  /**
   * Inline styles applied to the rendered root.
   */
  style?: CSSProperties;

  /**
   * Preset theme, deep partial overrides of light, or a preset/overrides tuple.
   */
  theme?: Theme;

  /**
   * Markdown source text to compile and render.
   */
  text: string;

  /**
   * Compiler feature configuration.
   */
  build?: FlowdownConfig;

  /**
   * Smoothly reveal appended compiled content.
   * @default false
   */
  smooth?: boolean | SmoothConfig;

  /**
   * Fade the trailing characters of newly revealed content.
   * @default false
   */
  shad?: boolean | ShadConfig;

  /**
   * Inline render patches applied to the Markdown source.
   */
  patches?: IPatchItem<ReactNode>[];

  /**
   * Plugin packs extending the compiler and React renderer.
   */
  plugins?: IPluginItem[];
}

export type FlowdownRef = IReadableClosure<ReactNode[]>;
