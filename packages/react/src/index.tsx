import type { ReactNode } from 'react';

import { Core, isPluggablesEqual } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import cn from 'classnames';
import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react';
import { D, render, S } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { FlowdownProps, FlowdownRef, ReactRenderExtraParams } from './types';

import { RootReconciler, SlotProvider } from './components';
import { DEFAULT_CONFIG, EL, EO } from './consts';
import { useDeferredUnmount, usePlugins, useStateOf, useStatic } from './hooks';
import { ReactRenderer } from './modules';
import { PRESET_RENDER_PLUGINS, PRESET_SLOT_PLUGINS } from './plugins';
import styles from './styles/index.module.scss';
import { useThemeStyles } from './theme';
import { isPatchesEqual, isPropsEqual, isSmoothEqual } from './utils';

export * from './types';

export const Flowdown = /*#__PURE__*/ memo(
  /*#__PURE__*/ forwardRef<FlowdownRef, FlowdownProps>(function Flowdown(
    {
      className,
      style,
      theme = 'light',
      text: _text,
      build: _build = EO,
      smooth: _smooth = false,
      patches: _patches = EL,
      plugins: _plugins = EL,
    },
    ref,
  ) {
    const themeStyles = useThemeStyles(theme);

    const [committed, setCommitted] = useState(false);

    const build = useStateOf(defaultsBy(_build, DEFAULT_CONFIG), shallowEqual);

    const smooth = useStateOf(committed ? _smooth : false, isSmoothEqual);

    useEffect(() => {
      setCommitted(true);
    }, []);

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
            text,
          },
        ]),
      ),
    );

    useImperativeHandle(ref, () => core, [core]);

    useDeferredUnmount(() => core.destroy());

    return (
      <SlotProvider plugins={slots}>
        <RootReconciler className={cn(styles.root, className)} style={{ ...themeStyles, ...style }}>
          {core.value}
        </RootReconciler>
      </SlotProvider>
    );
  }),
  isPropsEqual,
);
