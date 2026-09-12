export const SMOOTH_MARKDOWN = `# A smoother stream

Incoming Markdown arrives in uneven chunks. **Fluxdown reveals the rendered content gradually**, keeping formatting in place as each phrase grows.

## Watch the next paragraph

A few words arrive quickly, then a longer pause, then a burst of text. The preview turns those irregular updates into a continuous reading pace.

- Headings and paragraphs retain their identity.
- *Emphasis* appears as formatting, without flashing delimiters.
- Completed blocks stay visible while the next block grows.

> Pause the incoming stream to let the preview catch up, then press Play to continue.

\`\`\`tsx
<Fluxdown smooth text={markdown} />
\`\`\`

The stream is complete. Reset it to watch a different sequence of chunks.
`;
