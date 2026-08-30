import type { SmoothConfig } from '@flowdown/core';
import type { ReactNode } from 'react';

import { CoreStateClosure } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import { isEqual, isUndefined } from 'lodash-es';
import { forwardRef, memo, useImperativeHandle } from 'react';
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
      smooth: _smooth = false,
      build: _build = EO,
      patches: _patches = EL,
      plugins: _plugins = EL,
    },
    ref,
  ) {
    const build = useStateOf(defaultsBy(_build, DEFAULT_CONFIG), shallowEqual);

    const patches = useStateOf(_patches, isPatchesEqual);

    const text = useStateOf(_text);

    const smooth = useStateOf<boolean | SmoothConfig>(
      isUndefined(globalThis.document) ? false : _smooth,
      isEqual,
    );

    const _remarks = usePlugins(_plugins, 'remarks');

    const _rehypes = usePlugins(_plugins, 'rehypes');

    const _repairs = usePlugins(_plugins, 'repairs');

    const _renders = usePlugins(_plugins, 'renders', PRESET_RENDER_PLUGINS);

    const slots = usePlugins(_plugins, 'slots', PRESET_SLOT_PLUGINS);

    const remarks = useStateOf(_remarks, isPluggablesEqual);

    const rehypes = useStateOf(_rehypes, isPluggablesEqual);

    const repairs = useStateOf(_repairs, isPluggablesEqual);

    const renders = useStateOf(_renders, isPluggablesEqual);

    const core = useStatic(
      () =>
        new CoreStateClosure<ReactNode, ReactRenderExtraParams>({
          Renderer: ReactRenderer,
          build,
          patches,
          rehypes,
          remarks,
          renders,
          repairs,
          smooth,
          text,
        }),
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
