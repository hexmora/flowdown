# flowdown

`flowdown` is the React wrapper around `@flowdown/core`.

It provides the React layer for high-performance rendering of streaming Markdown text, while delegating Markdown stream computation to the headless core package. This keeps rendering concerns isolated and makes it easier to build responsive UI experiences for LLM output.

Render and slot plugins are provided by [`@flowdown/react-presets`](../react-presets). Import shared types, contexts, and base classes from `@flowdown/react-presets/base`, render plugins from `@flowdown/react-presets/render`, and slot plugins from `@flowdown/react-presets/slot`.

## License

MIT
