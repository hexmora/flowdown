/**
 * @jsxImportSource reactive
 */

import { type JSXDescriptor, once, useCreate } from 'reactive';

import type { SmoothCursorInputs } from './type';

import { BlockLengths, CursorPosition, type SmoothPosition, SmoothTicks } from './states';

export * from './type';

export const SmoothCursor = /*#__PURE__*/ once(function SmoothCursor<T>({
  source,
  enabled,
  ticker,
  scheduler,
}: SmoothCursorInputs<T>): JSXDescriptor<SmoothPosition> {
  const lengths = useCreate(<BlockLengths<T> source={source} />);

  return (
    <CursorPosition
      enabled={enabled}
      ticker={ticker}
      scheduler={scheduler}
      lengths={lengths}
      ticks={<SmoothTicks enabled={enabled} lengths={lengths} ticker={ticker} />}
    />
  );
});
