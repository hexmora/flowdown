import type { Table } from 'mdast';

import { max } from 'lodash-es';

export const normalizeTableColumns = (table: Table) => {
  const width = max(table.children.map((row) => row.children.length)) ?? 0;
  const align = table.align ?? [];

  if (align.length >= width) {
    return;
  }

  table.align = [...align, ...Array<null>(width - align.length).fill(null)];
};
