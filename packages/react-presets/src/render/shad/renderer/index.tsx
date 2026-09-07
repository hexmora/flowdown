import type { ShadRendererProps } from './type';

import styles from './index.module.scss';

export const ShadRenderer = ({ active, isActive, leading }: ShadRendererProps) => {
  return (
    <span className={styles.root}>
      <span className={styles.leading}>{leading}</span>
      <span className={styles.active}>{active}</span>
      <span aria-hidden={true} className={isActive ? styles.mask : styles.maskHidden} />
    </span>
  );
};
