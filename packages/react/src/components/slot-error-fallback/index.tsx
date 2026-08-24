import type { FallbackProps as ErrorBoundaryFallbackProps } from 'react-error-boundary';

import { useContext } from 'react';

import { SlotFallbackContext } from '../slot-renderer/context';

export const SlotErrorFallback = ({ error, resetErrorBoundary }: ErrorBoundaryFallbackProps) => {
  const value = useContext(SlotFallbackContext);

  if (!value?.Component) {
    return null;
  }

  const { Component, props, type } = value;

  return <Component error={error} onReset={resetErrorBoundary} props={props} type={type} />;
};
