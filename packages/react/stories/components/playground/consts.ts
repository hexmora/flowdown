import type { PlaygroundSettings } from './type';

export const DEFAULT_MARKDOWN = `# Flowdown Playground

Edit this Markdown and see the preview update immediately.

## Streaming-friendly content

- **Strong text** and *emphasis*
- [A useful link](https://example.com)
- Inline math: $E = mc^2$

> Flowdown keeps each rendered block reactive.

\`\`\`ts
const greeting = 'Hello, Flowdown!';
\`\`\`
`;

export const DEFAULT_PLAYGROUND_SETTINGS: PlaygroundSettings = {
  footnote: false,
  repair: false,
  repairEnding: false,
  tex: false,
};
