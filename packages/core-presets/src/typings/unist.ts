import type { Properties, RootContent } from 'hast';

declare module 'unist' {
  // Extending Record keeps additional plugin metadata mergeable when a
  // consumer loads both the ESM and CommonJS declaration graphs.
  interface Data extends Record<string, unknown> {
    /** Properties forwarded from mdast nodes to HAST elements. */
    hProperties?: Properties;

    /** Footnote section detached from the HAST content stream. */
    footnote?: RootContent;
  }
}
