import type { ReactNode } from 'react';

import { CoreStateClosure } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import { forwardRef, memo, useImperativeHandle } from 'react';
import { D, render, S } from 'reactive';
import { shallowEqual } from 'shallow-equal';

import type { FlowdownProps, FlowdownRef, ReactRenderExtraParams } from './types';

import { RootReconciler, SlotProvider } from './components';
import { DEFAULT_CONFIG, EL, EO } from './consts';
import { useDeferredUnmount, usePlugins, useStateOf, useStatic } from './hooks';
import { ReactRenderer } from './modules';
import { PRESET_RENDER_PLUGINS, PRESET_SLOT_PLUGINS } from './plugins';
import { isPatchesEqual, isPluggablesEqual, isPropsEqual } from './utils';

export const Flowdown = /*#__PURE__*/ memo(
  /*#__PURE__*/ forwardRef<FlowdownRef, FlowdownProps>(function Flowdown(
    {
      className,
      style,
      text: _text,
      config: _config = EO,
      patches: _patches = EL,
      plugins: _plugins = EL,
    },
    ref,
  ) {
    const config = useStateOf(defaultsBy(_config, DEFAULT_CONFIG), shallowEqual);

    const patches = useStateOf(_patches, isPatchesEqual);

    const text = useStateOf(_text);

    const _remarks = usePlugins(_plugins, 'remarks');

    const _rehypes = usePlugins(_plugins, 'rehypes');

    const _repairs = usePlugins(_plugins, 'repairs');

    const _renders = usePlugins(_plugins, 'renders', PRESET_RENDER_PLUGINS);

    const slots = usePlugins(_plugins, 'slots', PRESET_SLOT_PLUGINS);

    const remarks = useStateOf(_remarks, isPluggablesEqual);

    const rehypes = useStateOf(_rehypes, isPluggablesEqual);

    const repairs = useStateOf(_repairs, isPluggablesEqual);

    const renders = useStateOf(_renders, isPluggablesEqual);

    const core = useStatic(() =>
      render(
        S([
          CoreStateClosure<ReactNode, ReactRenderExtraParams>,
          {
            Renderer: D(ReactRenderer),
            config: D(config),
            patches: D(patches),
            rehypes: D(rehypes),
            remarks: D(remarks),
            renders: D(renders),
            repairs: D(repairs),
            text: D(text),
          },
        ]),
      ),
    );

    useImperativeHandle(ref, () => core, [core]);

    useDeferredUnmount(() => core.destroy());

    return (
      <SlotProvider plugins={slots}>
        <RootReconciler className={className} style={style}>
          {core.value}
        </RootReconciler>
      </SlotProvider>
    );
  }),
  isPropsEqual,
);
