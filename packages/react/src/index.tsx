import type { ReactNode } from 'react';

import { CoreStateClosure } from '@flowdown/core';
import { defaultsBy } from '@flowdown/utils';
import { forwardRef, useImperativeHandle } from 'react';
import { shallowEqual } from 'shallow-equal';

import type { FlowdownProps, FlowdownRef, ReactRenderExtraParams } from './types';

import { RootReconciler, SlotProvider } from './components';
import { DEFAULT_CONFIG } from './consts';
import { useDeferredUnmount, usePlugins, useStateOf, useStatic } from './hooks';
import { ReactRenderer } from './modules';
import { PRESET_RENDER_PLUGINS, PRESET_SLOT_PLUGINS } from './plugins';
import { isPatchesEqual } from './utils';

export const Flowdown = /*#__PURE__*/ forwardRef<FlowdownRef, FlowdownProps>(function Flowdown(
  {
    className,
    style,
    text: _text,
    config: _config = {},
    patches: _patches = [],
    plugins: _plugins = [],
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

  const remarks = useStateOf(_remarks, shallowEqual);

  const rehypes = useStateOf(_rehypes, shallowEqual);

  const repairs = useStateOf(_repairs, shallowEqual);

  const renders = useStateOf(_renders, shallowEqual);

  const core = useStatic(
    () =>
      new CoreStateClosure<ReactNode, ReactRenderExtraParams>({
        Renderer: ReactRenderer,
        config,
        patches,
        rehypes,
        remarks,
        renders,
        repairs,
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
});
