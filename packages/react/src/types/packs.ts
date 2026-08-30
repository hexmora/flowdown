import type {
  BlockCompilerConfig,
  CoreStateClosure,
  IPatchItem,
  PluginConfigs,
  SmoothConfig,
} from '@flowdown/core';
import type { IPluggable, IRehypePlugin, IRemarkPlugin, IRepairPlugin } from '@flowdown/types';
import type { CSSProperties, ReactNode } from 'react';

import type { IReactRenderPluggable, ReactRenderExtraParams } from './plugin';
import type { AnySlotPluggable } from './slots';

export interface IPluginItem {
  config?: PluginConfigs;

  remarks?: IPluggable<IRemarkPlugin, unknown>[];

  rehypes?: IPluggable<IRehypePlugin, unknown>[];

  repairs?: IPluggable<IRepairPlugin, unknown>[];

  renders?: IReactRenderPluggable[];

  slots?: AnySlotPluggable[];
}

export type FlowdownConfig = Partial<BlockCompilerConfig>;

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
   * Markdown source text to compile and render.
   */
  text: string;

  /**
   * Smooth appended rendered content across ticker updates.
   * @default false
   */
  smooth?: boolean | SmoothConfig;

  /**
   * Compiler feature configuration.
   */
  build?: FlowdownConfig;

  /**
   * Inline render patches applied to the Markdown source.
   */
  patches?: IPatchItem<ReactNode>[];

  /**
   * Plugin packs extending the compiler and React renderer.
   */
  plugins?: IPluginItem[];
}

export type FlowdownRef = CoreStateClosure<ReactNode, ReactRenderExtraParams>;
