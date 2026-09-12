<p align="center">
  <img src="./docs/assets/logo.png" alt="Fluxdown" width="480" />
</p>

**English** | [简体中文](./docs/README.zh-CN.md)

**A reactive Markdown rendering library built for streaming.**

Render Markdown as it arrives, from AI chat responses to live previews. Fluxdown keeps growing content responsive and gives you control over how it looks and behaves.

Start with the React component, or use the framework-independent core to build your own renderer.

## Features

- **High performance.** Reuses unchanged blocks and limits rendering work as new text arrives.
- **Fully reactive.** Text, configuration, and plugins react to state changes, keeping the output up to date without manual refreshes.
- **Highly customizable.** Bring your own styles and components, from links to code blocks.
- **Pluggable.** Extend Markdown syntax and rendering with composable plugins.
- **Framework-independent core.** [`@fluxdown/core`](./packages/core/README.md) is built on the framework-free [`functive`](./packages/functive/README.md) package and can power renderers for different UI frameworks.

## Quick start: React

The examples below use the React component provided by the `fluxdown` package.

### Install

In an existing React project:

```sh
npm install fluxdown
```

### Render Markdown

```jsx
import { Fluxdown } from "fluxdown";

export default function App() {
  return <Fluxdown text={"# Hello, Fluxdown\n\nMarkdown that **keeps up**."} />;
}
```

### Render a stream

Pass the accumulated Markdown to `text` as chunks arrive. Enable `smooth` to reveal new content gradually, with any streaming API.

```jsx
import { Fluxdown } from "fluxdown";

export function StreamingMessage({ text }) {
  return <Fluxdown smooth text={text} build={{ repair: true, repairEnding: true }} />;
}
```

### Customize the theme

Use `"light"` (default), `"dark"`, or `[preset, overrides]`. Partial token configurations extend light.

```jsx
<Fluxdown
  text="# Your Markdown"
  theme={["dark", { tokens: { heading: { h1: { fontSize: "2.25rem" } } } }]}
/>
```

## Contributing

Bug reports, documentation improvements, and pull requests are welcome. When [reporting a bug](https://github.com/hexmora/flowdown/issues), include a minimal reproduction and the Markdown input that triggers it.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development commands and pull request guidelines.

## License

[MIT](./LICENSE)
