**English** | [简体中文](./docs/README.zh-CN.md)

# Flowdown

**A reactive Markdown rendering library built for streaming.**

Render Markdown as it arrives, from AI chat responses to live previews. Flowdown keeps growing content responsive and gives you control over how it looks and behaves.

Start with the React component, or use the framework-independent core to build your own renderer.

## Features

- **High performance.** Reuses unchanged blocks and limits rendering work as new text arrives.
- **Fully reactive.** Text, configuration, and plugins react to state changes, keeping the output up to date without manual refreshes.
- **Highly customizable.** Bring your own styles and components, from links to code blocks.
- **Pluggable.** Extend Markdown syntax and rendering with composable plugins.
- **Framework-independent core.** [`@flowdown/core`](./packages/core/README.md) is built on the framework-free [`reactive`](./packages/reactive/README.md) package and can power renderers for different UI frameworks.

## Quick start: React

The examples below use the React component provided by the `flowdown` package.

### Install

In an existing React project:

```sh
npm install flowdown
```

### Render Markdown

```jsx
import { Flowdown } from "flowdown";

export default function App() {
  return <Flowdown text={"# Hello, Flowdown\n\nMarkdown that **keeps up**."} />;
}
```

### Render a stream

Pass the full Markdown text received so far to `text`, appending each new chunk to your application's state. Flowdown updates as the text grows and works with whichever streaming API you use.

```jsx
import { Flowdown } from "flowdown";

export function StreamingMessage({ text }) {
  return <Flowdown text={text} config={{ repair: true, repairEnding: true }} />;
}
```

## Contributing

Bug reports, documentation improvements, and pull requests are welcome. When [reporting a bug](https://github.com/hexmora/flowdown/issues), include a minimal reproduction and the Markdown input that triggers it.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development commands and pull request guidelines.

## License

[MIT](./LICENSE)
