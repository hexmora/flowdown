import { memo, useContext, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import type { SlotRendererProps } from './type';

import { SlotErrorFallback } from '../slot-error-fallback';
import { SlotFallbackContext, SlotsContext } from './context';
import { composePlugins, isNamedSlot } from './utils/compose';

export * from './utils';

export const SlotRenderer = /*#__PURE__*/ memo(function SlotRenderer({
  props,
  type,
}: SlotRendererProps) {
  const slots = useContext(SlotsContext);

  const currentPlugins = slots?.[type];

  const wrapperPlugins = slots?.Wrapper;

  const fallbackPlugins = slots?.Fallback;

  const Component = useMemo(() => composePlugins(currentPlugins ?? []), [currentPlugins]);

  const Wrapper = useMemo(() => composePlugins(wrapperPlugins ?? []), [wrapperPlugins]);

  const Fallback = useMemo(() => composePlugins(fallbackPlugins ?? []), [fallbackPlugins]);

  const fallbackContext = useMemo(
    () => (isNamedSlot(type) ? { Component: Fallback, props, type } : null),
    [Fallback, props, type],
  );

  if (!slots) {
    throw new Error(`The ${type} slot must be rendered within a SlotProvider.`);
  }

  if (!Component) {
    return null;
  }

  if (!isNamedSlot(type)) {
    return <Component {...props} />;
  }

  const named = <Component {...props} />;

  const wrapped = Wrapper ? (
    <Wrapper props={props} type={type}>
      {named}
    </Wrapper>
  ) : (
    named
  );

  return (
    <SlotFallbackContext.Provider value={fallbackContext}>
      <ErrorBoundary
        FallbackComponent={SlotErrorFallback}
        resetKeys={[Component, Wrapper, Fallback, props]}
      >
        {wrapped}
      </ErrorBoundary>
    </SlotFallbackContext.Provider>
  );
});
