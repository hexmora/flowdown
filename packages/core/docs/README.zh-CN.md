[English](../README.md) | **简体中文**

# @fluxdown/core

**框架无关的流式 Markdown 处理引擎。**

将 Markdown 转为响应式内容块，并连接到自己的渲染器。`@fluxdown/core` 负责 Markdown 的处理与更新，UI 框架和输出格式由你选择。

可以用它构建框架集成，也可以将 Markdown 作为结构化数据处理。如果需要开箱即用的 React 组件，请参阅 [Fluxdown](../../../docs/README.zh-CN.md#快速上手react)。Core 的状态流由 [`functive`](../../functive/docs/README.zh-CN.md) 提供支持。

## 特点

- **高性能。** 复用已有内容块，减少文本更新时不必要的重复编译。
- **纯响应式。** 文本、配置和插件的变化会传递到输出。
- **框架无关。** 无需 React 或 DOM 环境即可运行。
- **自定义渲染器。** 直接处理 HTML 语法树（HAST），或将内容块连接到目标框架的组件。
- **插件化。** 扩展 Markdown 语法、语法树转换、不完整 Markdown 的处理和渲染。

## 快速上手

### 安装

```sh
npm install @fluxdown/core functive
```

### 处理流式 Markdown

`Core` 接收一个渲染器，由它决定每个内容块的输出。下面的简单渲染器直接返回响应式内容块，便于查看它们的 HAST 树：

```ts
import { BaseRenderer, Core, type HastRoot } from "@fluxdown/core";
import type { IBlockState } from "@fluxdown/types";
import type { ElementContent, Parent } from "hast";
import { D, MutableState, render, S } from "functive";

type MarkdownBlock = IBlockState<HastRoot>;

class BlocksRenderer extends BaseRenderer<HastRoot, ElementContent, Parent, MarkdownBlock> {
  protected renderItem(block: MarkdownBlock): MarkdownBlock {
    return block;
  }
}

const text = MutableState.of("# Hello, Fluxdown");
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

向 `text.next` 传入当前已收到的完整 Markdown 文本，每收到一个新片段，就将它追加到之前的文本。示例在整个流式过程中始终开启对不完整 Markdown 的修复。

`D(BlocksRenderer)` 将渲染器类作为静态值传入。`render` 创建 Core 实例，`core.value.value` 获取当前的输出数组。有关状态闭包和输入值的更多说明，请参阅 [`functive` 指南](../../functive/docs/README.zh-CN.md)。

## 渲染与更新

每个编译后的内容块通过 `block.value` 提供内容。在上面的示例中，`block.value.value` 是当前的 HAST 树。渲染器可以用这些内容块生成框架组件或其他类型的输出。

内容块的内容可能发生变化，而内容块和输出数组仍保持相同的引用。接入 UI 时，请订阅外层的 `core.value` 以接收列表变化，同时订阅各个 `block.value` 以接收内容更新。内容块加入或离开列表时，需要相应地建立或清理订阅。

使用完毕后，请销毁 Core 实例。Core 会释放自己管理的状态闭包和插件实例；`text` 这样的外部输入仍由你管理，需要单独清理。

## 插件

Core 内置预设的 Markdown 处理插件。可以通过 `remarks` 扩展 Markdown 语法，通过 `rehypes` 转换 HAST，以及通过 `repairs` 处理不完整的 Markdown。渲染插件通过 `renders` 传入，供渲染器使用。

这些输入可以是响应式的，因此可以随文本一起更新插件配置。可用的预设插件见 [`@fluxdown/core-presets`](../../core-presets)。

## 参与贡献

欢迎报告问题、改进文档或提交 Pull Request。[报告问题](https://github.com/hexmora/flowdown/issues)时，请提供最小复现示例、Markdown 输入，以及触发问题的更新过程。

开发命令和 Pull Request 指南见 [CONTRIBUTING.md](../../../CONTRIBUTING.md)。

## 许可证

[MIT](../../../LICENSE)
