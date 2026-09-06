import cn from 'classnames';

import type { TexProps } from '../../../../../../types';

import styles from '../../index.module.scss';

export const LightTexRenderer = ({ className, mode = 'inline', style, tex }: TexProps) => {
  const Root = mode === 'display' ? 'div' : 'span';

  return (
    <Root className={cn(styles.root, className)} data-mode={mode} style={style}>
      {tex}
    </Root>
  );
};
