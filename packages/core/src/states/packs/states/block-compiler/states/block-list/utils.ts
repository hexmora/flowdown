import type { IDestructible } from '@flowdown/utils';

export const destroyAll = (items: readonly IDestructible[]) => {
  for (const item of items) {
    item.destroy();
  }
};
