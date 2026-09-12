<p align="center">
  <img src="./assets/logo.png" alt="Fluxdown" width="480" />
</p>

[English](../README.md) | **简体中文**

**专为流式场景打造的响应式 Markdown 渲染库。**

从 AI 对话到实时预览，Fluxdown 随内容到达持续渲染 Markdown，让不断增长的内容保持流畅，并让你自由控制渲染结果的外观与行为。

可以直接使用现有的 React 组件，也可以基于框架无关的核心构建自己的渲染器。

## 特点

- **高性能。** 复用未变化的内容块，减少新文本到达时的渲染开销。
- **纯响应式。** 文本、配置和插件都响应状态变化，渲染结果自动更新，无需手动刷新。
- **高度可定制。** 自定义样式，也可以用自己的组件渲染链接、代码块等元素。
- **插件化。** 通过可组合的插件扩展 Markdown 语法与渲染方式。
- **核心层框架无关。** [`@fluxdown/core`](../packages/core/docs/README.zh-CN.md) 基于框架无关的 [`functive`](../packages/functive/docs/README.zh-CN.md) 包构建，可用于实现不同 UI 框架的渲染器。

## 快速上手：React

以下示例使用 `fluxdown` 包提供的 React 组件。

### 安装

在已有的 React 项目中安装：

```sh
npm install fluxdown
```

### 渲染 Markdown

```jsx
import { Fluxdown } from "fluxdown";

export default function App() {
  return <Fluxdown text={"# Hello, Fluxdown\n\nMarkdown that **keeps up**."} />;
}
```

### 流式渲染

每收到一个片段，就将累积的 Markdown 传给 `text`。开启 `smooth` 后，新内容会逐步平滑显示，可搭配任意流式 API。

```jsx
import { Fluxdown } from "fluxdown";

export function StreamingMessage({ text }) {
  return <Fluxdown smooth text={text} build={{ repair: true, repairEnding: true }} />;
}
```

### 定制主题

支持 `"light"`（默认）、`"dark"` 或 `[preset, overrides]`。直接传入部分 token 配置时扩展 light。

```jsx
<Fluxdown
  text="# 你的 Markdown"
  theme={["dark", { tokens: { heading: { h1: { fontSize: "2.25rem" } } } }]}
/>
```

## 参与贡献

欢迎报告问题、改进文档或提交 Pull Request。[报告问题](https://github.com/hexmora/flowdown/issues)时，请提供最小复现示例，以及触发问题的 Markdown 输入。

开发命令和 Pull Request 指南见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 许可证

[MIT](../LICENSE)
