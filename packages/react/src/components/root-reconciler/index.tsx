import { Fragment, isValidElement, memo } from 'react';

import type { RootReconcilerProps } from './type';

import { useStateValue } from '../../hooks';

export const RootReconciler = /*#__PURE__*/ memo(function RootReconciler({
  children,
  className,
  style,
}: RootReconcilerProps) {
  const value = useStateValue(children);

  return (
    <div className={className} style={style}>
      {value.map((child, index) => (
        <Fragment key={isValidElement(child) ? (child.key ?? index) : index}>{child}</Fragment>
      ))}
    </div>
  );
});
