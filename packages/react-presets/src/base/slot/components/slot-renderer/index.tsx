import { memo, useContext, useMemo } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import type { SlotRendererProps } from './type';

import { useStatic } from '../../../hooks';
import { SlotFallbackContext, SlotsContext } from '../../context';
import { createSlotComposer, isNamedSlot } from '../../utils';
import { SlotErrorFallback } from '../slot-error-fallback';

export * from './type';

export const SlotRenderer = /*#__PURE__*/ memo(function SlotRenderer({
  props,
  type,
}: SlotRendererProps) {
  const slots = useContext(SlotsContext);

  const composePlugins = useStatic(createSlotComposer);

  const currentPlugins = slots?.[type];

  const wrapperPlugins = slots?.Wrapper;

  const fallbackPlugins = slots?.Fallback;

  const Component = useMemo(
    () => composePlugins(currentPlugins ?? []),
    [composePlugins, currentPlugins],
  );

  const Wrapper = useMemo(
    () => composePlugins(wrapperPlugins ?? []),
    [composePlugins, wrapperPlugins],
  );

  const Fallback = useMemo(
    () => composePlugins(fallbackPlugins ?? []),
    [composePlugins, fallbackPlugins],
  );

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
