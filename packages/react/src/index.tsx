import type { ReactRenderExtraParams } from '@fluxdown/react-presets/base';
import type { ReactNode } from 'react';

import { Core, isPluggablesEqual } from '@fluxdown/core';
import {
  SlotProvider,
  useDeferredUnmount,
  useStateOf,
  useStatic,
} from '@fluxdown/react-presets/base';
import { PRESET_RENDER_PLUGINS } from '@fluxdown/react-presets/render';
import { PRESET_SLOT_PLUGINS } from '@fluxdown/react-presets/slot';
import { defaultsBy } from '@fluxdown/utils';
import cn from 'classnames';
import { D, render, S } from 'functive';
import { forwardRef, memo, useImperativeHandle } from 'react';
import { shallowEqual } from 'shallow-equal';

import type { FluxdownProps, FluxdownRef } from './types';

import { RootReconciler } from './components';
import { DEFAULT_CONFIG, EL, EO } from './consts';
import { usePlugins, useShadStyles } from './hooks';
import { ReactRenderer } from './modules';
import styles from './styles/index.module.scss';
import { useThemeStyles } from './theme';
import { isPatchesEqual, isPropsEqual, isShadEqual, isSmoothEqual } from './utils';

export * from './types';

export const Fluxdown = /*#__PURE__*/ memo(
  /*#__PURE__*/ forwardRef<FluxdownRef, FluxdownProps>(function Fluxdown(
    {
      className,
      style,
      theme = 'light',
      text: _text,
      build: _build = EO,
      smooth: _smooth = false,
      shad: _shad = false,
      patches: _patches = EL,
      plugins: _plugins = EL,
    },
    ref,
  ) {
    const themeStyles = useThemeStyles(theme);

    const shadStyles = useShadStyles(_shad);

    const build = useStateOf(defaultsBy(_build, DEFAULT_CONFIG), shallowEqual);

    const smooth = useStateOf(_smooth, isSmoothEqual);

    const shad = useStateOf(_shad, isShadEqual);

    const patches = useStateOf(_patches, isPatchesEqual);

    const text = useStateOf(_text);

    const _remarks = usePlugins(_plugins, 'remarks');

    const _rehypes = usePlugins(_plugins, 'rehypes');

    const _repairs = usePlugins(_plugins, 'repairs');

    const _mappers = usePlugins(_plugins, 'mappers');

    const _renders = usePlugins(_plugins, 'renders', PRESET_RENDER_PLUGINS);

    const slots = usePlugins(_plugins, 'slots', PRESET_SLOT_PLUGINS);

    const remarks = useStateOf(_remarks, isPluggablesEqual);

    const rehypes = useStateOf(_rehypes, isPluggablesEqual);

    const repairs = useStateOf(_repairs, isPluggablesEqual);

    const mappers = useStateOf(_mappers, isPluggablesEqual);

    const renders = useStateOf(_renders, isPluggablesEqual);

    const core = useStatic(() =>
      render(
        S([
          Core<ReactNode, ReactRenderExtraParams>,
          {
            Renderer: D(ReactRenderer),
            build,
            patches,
            rehypes,
            remarks,
            renders,
            repairs,
            mappers,
            smooth,
            shad,
            text,
          },
        ]),
      ),
    );

    useImperativeHandle(ref, () => core, [core]);

    useDeferredUnmount(() => core.destroy());

    return (
      <SlotProvider plugins={slots}>
        <RootReconciler
          className={cn(styles.root, className)}
          style={{ ...themeStyles, ...shadStyles, ...style }}
        >
          {core.value}
        </RootReconciler>
      </SlotProvider>
    );
  }),
  isPropsEqual,
);
