import { useStateValue } from '@fluxdown/react-presets/base';
import cn from 'classnames';
import { Fragment, isValidElement, memo } from 'react';

import type { RootReconcilerProps } from './type';

import { ROOT_CLASS_NAME } from './consts';
import styles from './index.module.less';

export const RootReconciler = /*#__PURE__*/ memo(function RootReconciler({
  children,
  className,
  style,
}: RootReconcilerProps) {
  const value = useStateValue(children);

  return (
    <div className={cn(styles.root, ROOT_CLASS_NAME, className)} style={style}>
      {value.map((child, index) => (
        <Fragment key={isValidElement(child) ? (child.key ?? index) : index}>{child}</Fragment>
      ))}
    </div>
  );
});
