**English** | [简体中文](./docs/README.zh-CN.md)

# @flowdown/core

**The framework-independent engine for streaming Markdown.**

Turn Markdown into reactive content blocks and connect them to your own renderer. `@flowdown/core` handles Markdown processing and updates, while you choose the UI framework or output format.

Use it to build a framework integration or work with Markdown as structured data. For a ready-to-use React component, see [Flowdown](../../README.md#quick-start-react). Core's state flows are powered by [`reactive`](../reactive/README.md).

## Features

- **High performance.** Reuses existing blocks and reduces unnecessary compilation as text updates.
- **Fully reactive.** Text, configuration, and plugin changes flow through to the output.
- **Framework-independent.** Runs without React or a DOM environment.
- **Your own renderer.** Work with HTML syntax trees (HAST) or connect blocks to components for your target framework.
- **Pluggable.** Extend Markdown syntax, tree transformations, handling of incomplete Markdown, and rendering.

## Quick start

### Install

```sh
npm install @flowdown/core reactive
```

### Process streaming Markdown

`Core` takes a renderer that determines the output for each block. This small renderer returns the reactive blocks themselves so you can inspect their HAST trees:

```ts
import { BaseRenderer, Core, type HastRoot } from "@flowdown/core";
import type { IBlockState } from "@flowdown/types";
import type { ElementContent, Parent } from "hast";
import { D, MutableState, render, S } from "reactive";

type MarkdownBlock = IBlockState<HastRoot>;

class BlocksRenderer extends BaseRenderer<HastRoot, ElementContent, Parent, MarkdownBlock> {
  protected renderItem(block: MarkdownBlock): MarkdownBlock {
    return block;
  }
}

const text = MutableState.of("# Hello, Flowdown");
const core = render(
  S([
    Core<MarkdownBlock>,
    {
      Renderer: D(BlocksRenderer),
      text,
      config: { repair: true, repairEnding: true, footnote: false, tex: false },
      patches: [],
      renders: [],
    },
  ]),
);

const readTrees = () => core.value.value.map((block) => block.value.value);

console.log(readTrees());

text.next(text.value + "\n\nMarkdown that **keeps up**.");
console.log(readTrees());

core.destroy();
text.destroy();
```

Pass the full Markdown text received so far to `text.next`, appending each new chunk to the previous text. The example keeps repairs enabled for incomplete Markdown throughout the stream.

`D(BlocksRenderer)` passes the renderer class as a static value. `render` creates the core instance, and `core.value.value` gives its current output array. See the [`reactive` guide](../reactive/README.md) for more on state closures and input values.

## Rendering and updates

Each compiled block exposes its content through `block.value`. In the example above, `block.value.value` is its current HAST tree. Your renderer can use these blocks to produce framework components or another output type.

Block content can change while the block and output array keep the same identity. When connecting a UI, observe the outer `core.value` for list changes and each `block.value` for content updates. Manage those subscriptions as blocks enter and leave the list.

Destroy the core instance when you are done with it. Core releases the state closures and plugin instances it owns; external inputs such as `text` remain under your control and need their own cleanup.

## Plugins

Core includes preset Markdown processing plugins. Add to them through `remarks` for Markdown syntax, `rehypes` for HAST transformations, and `repairs` for handling incomplete Markdown. Supply render plugins through `renders` for your renderer to use.

These inputs can be reactive, so you can update plugin configuration alongside the text. For the available preset plugins, see [`@flowdown/core-presets`](../core-presets).

## Contributing

Bug reports, documentation improvements, and pull requests are welcome. When [reporting a bug](https://github.com/hexmora/flowdown/issues), include a minimal reproduction, the Markdown input, and the sequence of updates that triggers it.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development commands and pull request guidelines.

## License

[MIT](../../LICENSE)
