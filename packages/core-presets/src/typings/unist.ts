import type { Properties, RootContent } from 'hast';

declare module 'unist' {
  interface Data {
    /** Additional metadata owned by external unified plugins. */
    [key: string]: unknown;

    /** Properties forwarded from mdast nodes to HAST elements. */
    hProperties?: Properties;

    /** Footnote section detached from the HAST content stream. */
    footnote?: RootContent;
  }
}
